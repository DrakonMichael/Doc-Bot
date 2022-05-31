let lines = {};

lines.ru = {};
lines.ru.normal = {};
lines.ru.normal.entry = "Привет! Я бот-докобот. Помогу тебе собрать все документы в нужную папку.";
lines.ru.normal.request_en = "Введи номер заявки, которую ты ведёшь:";
lines.ru.normal.request_mail = "Введи свой gmail:";
lines.ru.normal.setup_complete = "The setup has been completed. File uploads will be prompted from now on.";
lines.ru.normal.document_detected = (usrnm) => `Привет, ${usrnm}\nPlease choose where to send this document.`;
lines.ru.normal.upload = (filename, type) => `File ${filename} uploaded to Drive.`;

lines.ru.context = {};
lines.ru.context.other = "Другое";
lines.ru.context.count = "Cчёт";
lines.ru.context.passport = "Паспорт";
lines.ru.context.cancel = "Нажми  сюда, если я не вовремя";

lines.ru.error = {};
lines.ru.error.already_created = "[ERR_ALR_CREATED]: There is already a running session in this chat.";
lines.ru.error.no_session = "[ERR_NO_SESSION]: There is no session currently running. Begin one with /start";
lines.ru.error.no_access = "[ERR_NO_ACCESS]: You do not have access to this command";
lines.ru.error.no_key = "[ERR_NO_KEY]: Please enter an entry number when running /start. The command should be in form /start [case_num]."
lines.ru.error.already_exists = (name) => `[ERR_ALREADY_EXISTS]: This entry already exists, it was created by ${name}`;
lines.ru.error.already_exists_nn = `[ERR_ALREADY_EXISTS]: This entry already exists, but its creator could not be resolved.`;

export default lines;