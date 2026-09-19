(() => {
  const CONFIG_EVENT = "youtube-auto-pip-config-changed";
  const RESTORE_EVENT = "youtube-auto-pip-restore-inline";
  const CONFIG_ATTRIBUTE = "data-youtube-auto-pip-enabled";
  let enabled = true;
  let session = null;

  function getVideo() {
    const videos = [...document.querySelectorAll("video")];
    return videos.find((video) => !video.paused && !video.ended) ??
      videos[0] ??
      session?.video ??
      null;
  }

  function getVideoAspectRatio(video) {
    const ratio = video.videoWidth / video.videoHeight;
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 16 / 9;
  }

  function getInitialWindowSize(aspectRatio) {
    const longestSide = 480;

    if (aspectRatio >= 1) {
      return {
        width: longestSide,
        height: Math.round(longestSide / aspectRatio)
      };
    }

    return {
      width: Math.round(longestSide * aspectRatio),
      height: longestSide
    };
  }

  function lockWindowAspectRatio(pipWindow, aspectRatio) {
    const minimumWidth = 240;
    const minimumHeight = 135;
    let previousWidth = pipWindow.innerWidth;
    let previousHeight = pipWindow.innerHeight;
    let animationFrame = 0;
    let correcting = false;
    let correctionTimer = 0;

    function rememberCurrentSize() {
      previousWidth = pipWindow.innerWidth;
      previousHeight = pipWindow.innerHeight;
    }

    function correctAspectRatio() {
      animationFrame = 0;
      if (pipWindow.closed) return;

      const width = pipWindow.innerWidth;
      const height = pipWindow.innerHeight;
      if (!width || !height) return;

      if (correcting) {
        correcting = false;
        clearTimeout(correctionTimer);
        rememberCurrentSize();
        return;
      }

      const ratioError = Math.abs(width / height - aspectRatio) / aspectRatio;
      if (ratioError < 0.004) {
        rememberCurrentSize();
        return;
      }

      const widthChange = Math.abs(width - previousWidth) / Math.max(previousWidth, 1);
      const heightChange = Math.abs(height - previousHeight) / Math.max(previousHeight, 1);
      let targetWidth = width;
      let targetHeight = height;

      if (widthChange >= heightChange) {
        targetHeight = targetWidth / aspectRatio;
      } else {
        targetWidth = targetHeight * aspectRatio;
      }

      if (targetWidth < minimumWidth) {
        targetWidth = minimumWidth;
        targetHeight = targetWidth / aspectRatio;
      }

      if (targetHeight < minimumHeight) {
        targetHeight = minimumHeight;
        targetWidth = targetHeight * aspectRatio;
      }

      const windowFrameWidth = Math.max(0, pipWindow.outerWidth - pipWindow.innerWidth);
      const windowFrameHeight = Math.max(0, pipWindow.outerHeight - pipWindow.innerHeight);

      try {
        correcting = true;
        previousWidth = targetWidth;
        previousHeight = targetHeight;
        pipWindow.resizeTo(
          Math.round(targetWidth + windowFrameWidth),
          Math.round(targetHeight + windowFrameHeight)
        );

        correctionTimer = setTimeout(() => {
          correcting = false;
          if (!pipWindow.closed) rememberCurrentSize();
        }, 100);
      } catch {
        correcting = false;
        rememberCurrentSize();
      }
    }

    function handleResize() {
      if (animationFrame) pipWindow.cancelAnimationFrame(animationFrame);
      animationFrame = pipWindow.requestAnimationFrame(correctAspectRatio);
    }

    pipWindow.addEventListener("resize", handleResize);

    return () => {
      pipWindow.removeEventListener("resize", handleResize);
      if (animationFrame) pipWindow.cancelAnimationFrame(animationFrame);
      clearTimeout(correctionTimer);
    };
  }

  function restoreVideo() {
    if (!session || session.restored) return;

    const current = session;
    current.restored = true;
    session = null;
    current.removeAspectRatioLock?.();

    try {
      const targetParent = current.placeholder.parentNode ||
        (current.parent.isConnected ? current.parent : null) ||
        document.querySelector(".html5-video-container");

      if (targetParent) {
        if (current.placeholder.parentNode === targetParent) {
          targetParent.insertBefore(current.video, current.placeholder);
          current.placeholder.remove();
        } else {
          targetParent.append(current.video);
        }
      }

      if (current.styleAttribute === null) {
        current.video.removeAttribute("style");
      } else {
        current.video.setAttribute("style", current.styleAttribute);
      }

      current.video.controls = current.controls;
      window.dispatchEvent(new Event("resize"));
    } catch {
      // YouTube may replace the player during navigation.
    }
  }

  async function openDocumentPiP() {
    if (!enabled || location.pathname !== "/watch" || session ||
        window.documentPictureInPicture?.window ||
        !("documentPictureInPicture" in window)) {
      return;
    }

    const video = getVideo();
    if (!video || video.paused || video.ended ||
        video.readyState < HTMLMediaElement.HAVE_METADATA) {
      return;
    }

    const aspectRatio = getVideoAspectRatio(video);
    const size = getInitialWindowSize(aspectRatio);

    try {
      const pipWindow = await documentPictureInPicture.requestWindow({
        ...size,
        preferInitialWindowPlacement: false
      });

      const parent = video.parentNode;
      if (!parent) {
        pipWindow.close();
        return;
      }

      const placeholder = document.createComment("youtube-auto-pip-video-position");
      parent.insertBefore(placeholder, video);

      session = {
        pipWindow,
        video,
        parent,
        placeholder,
        styleAttribute: video.getAttribute("style"),
        controls: video.controls,
        restored: false,
        removeAspectRatioLock: null
      };

      const style = pipWindow.document.createElement("style");
      style.textContent = [
        "*{box-sizing:border-box}",
        "html,body{position:fixed;inset:0;width:100%;height:100%;margin:0;padding:0;background:#000;overflow:hidden}",
        "body{display:grid;place-items:center}",
        "video{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important;padding:0!important;display:block!important;object-fit:cover!important;background:#000!important}"
      ].join("");
      pipWindow.document.head.append(style);

      video.controls = true;
      video.style.cssText = [
        "position:absolute!important",
        "inset:0!important",
        "width:100%!important",
        "height:100%!important",
        "margin:0!important",
        "padding:0!important",
        "display:block!important",
        "object-fit:cover!important",
        "background:#000!important"
      ].join(";");
      pipWindow.document.body.append(video);

      session.removeAspectRatioLock = lockWindowAspectRatio(pipWindow, aspectRatio);
      pipWindow.addEventListener("pagehide", restoreVideo, { once: true });
    } catch {
      restoreVideo();
    }
  }

  function restoreInline() {
    const pipWindow = session?.pipWindow || window.documentPictureInPicture?.window;

    if (pipWindow && !pipWindow.closed) {
      try {
        pipWindow.close();
      } catch {
        restoreVideo();
      }
    }

    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }

    setTimeout(() => {
      if (session && (!session.pipWindow || session.pipWindow.closed)) {
        restoreVideo();
      }
    }, 100);
  }

  function registerAutoPiP() {
    try {
      navigator.mediaSession.setActionHandler(
        "enterpictureinpicture",
        enabled ? openDocumentPiP : null
      );
    } catch {
      // Automatic PiP is unavailable for the current media session.
    }
  }

  function readConfig() {
    const value = document.documentElement?.getAttribute(CONFIG_ATTRIBUTE);
    if (value !== null) enabled = value === "true";
    registerAutoPiP();
  }

  window.addEventListener(CONFIG_EVENT, readConfig);
  window.addEventListener(RESTORE_EVENT, restoreInline);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") restoreInline();
  });

  document.addEventListener("playing", () => {
    setTimeout(registerAutoPiP);
  }, true);

  document.addEventListener("yt-navigate-finish", registerAutoPiP);

  readConfig();
})();