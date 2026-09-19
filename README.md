# YouTube Auto PiP 

Автоматический и ручной режимы используют один системный API Chrome: video.requestPictureInPicture().

Расширение защищает обработчик enterpictureinpicture от перезаписи кодом YouTube. Поэтому автоматический режим больше не должен открывать Document Picture-in-Picture с обычными HTML-элементами управления.

При возврате на вкладку YouTube расширение сначала ждёт штатного закрытия PiP браузером. Резервный выход запускается через задержку, чтобы не ломать состояние плеера при быстром переключении вкладок.

## Установка

1. Отключите или удалите все старые версии в `chrome://extensions`.
2. Распакуйте ZIP и загрузите папку `YouTube-Auto-PiP-1.0.10`.
3. Полностью обновите вкладку YouTube через `Ctrl+R`.

Кнопка в меню оставлена для проверки обычного нативного PiP. Автоматический режим работает через новый механизм.
<a href="https://youtube.com/@твой_канал" target="_blank">
  <img src="https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="YouTube" />
</a>
