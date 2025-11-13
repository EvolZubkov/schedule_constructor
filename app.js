// --- ГЛОБАЛЬНОЕ СОСТОЯНИЕ ---
const tasks = [];            // итоговый массив блоков
let currentActions = [];     // actions для текущего блока

// --- DOM элементы ---
const descriptionInput = document.getElementById("description");
const scheduleInput = document.getElementById("scheduleDatetime");
const datetimeInput = document.getElementById("datetime");
const isActiveInput = document.getElementById("isActive");
const extraInput = document.getElementById("extra");

const queryRowsContainer = document.getElementById("queryRows");
const addQueryRowBtn = document.getElementById("addQueryRowBtn");
const currentQueryPreview = document.getElementById("currentQueryPreview");

const actionTypeSelect = document.getElementById("actionType");
const actionFieldsContainer = document.getElementById("actionFieldsContainer");
const addActionBtn = document.getElementById("addActionBtn");
const clearActionsBtn = document.getElementById("clearActionsBtn");
const currentActionsPreview = document.getElementById("currentActionsPreview");

const addBlockBtn = document.getElementById("addBlockBtn");
const clearBlockFormBtn = document.getElementById("clearBlockFormBtn");
const clearAllBlocksBtn = document.getElementById("clearAllBlocksBtn");

const tasksJsonEditor = document.getElementById("tasksJsonEditor");
const applyJsonBtn = document.getElementById("applyJsonBtn");
const downloadBtn = document.getElementById("downloadBtn");
const countTag = document.getElementById("countTag");
const jsonStatus = document.getElementById("jsonStatus");
function highlightJsonError(error, textarea) {
  const text = textarea.value;
  const msg = (error && error.message) || "";
  let index = null;

  // Пытаемся вытащить "position 399" из текста ошибки
  const m = msg.match(/position\s+(\d+)/i);
  if (m) {
    index = parseInt(m[1], 10);
  }

  let line = 1;
  let col = 1;
  let lineText = "";
  let hint = "";

  if (index != null && !Number.isNaN(index) && index >= 0 && index <= text.length) {
    // считаем строку/столбец
    for (let i = 0; i < index; i++) {
      if (text[i] === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
    }

    // ищем границы строки
    let lineStart = index;
    while (lineStart > 0 && text[lineStart - 1] !== "\n") {
      lineStart--;
    }
    let lineEnd = index;
    while (lineEnd < text.length && text[lineEnd] !== "\n") {
      lineEnd++;
    }
    lineText = text.slice(lineStart, lineEnd);

    // выделяем проблемный символ
    textarea.focus();
    textarea.setSelectionRange(index, Math.min(index + 1, text.length));

    // чуть-чуть скроллим к нужной строке
    const before = text.slice(0, index);
    const linesBefore = before.split("\n").length;
    const approxLineHeight = 16;
    textarea.scrollTop = (linesBefore - 3) * approxLineHeight;

    // --- ХЕВРИСТИКИ ПОДСКАЗКИ ---

    const trimmedLine = lineText.trim();
    const charAtPos = text[index];

    if (/Unexpected end of JSON input/i.test(msg)) {
      hint = "Обычно это значит, что где-то выше не хватает закрывающей скобки '}' или ']'. Посчитай пары скобок.";
    } else if (/Expected ',' or '}/i.test(msg) || /Expected ',' or ']/i.test(msg)) {
      hint = "Чаще всего тут не хватает запятой в конце предыдущей строки перед этим блоком.";
    } else if (/Unexpected string/i.test(msg) || /Unexpected number/i.test(msg)) {
      hint = "Обычно это означает, что перед этим значением пропущена запятая.";
    } else if (/Unexpected token/i.test(msg) && (charAtPos === '}' || charAtPos === ']')) {
      hint = "Часто это лишняя запятая перед закрывающей скобкой '}' или ']'. Проверь строку выше.";
    } else if (/Unexpected token/i.test(msg) && trimmedLine.startsWith('"')) {
      hint = "Возможно, перед этим полем пропущена запятая.";
    } else {
      hint = "Посмотри внимательно на эту строку и строку выше: скорее всего проблема с запятой или скобкой.";
    }
  } else {
    // позицию не смогли найти – даём хотя бы общий текст
    line = null;
    col = null;
    hint = "Посмотри на конец файла: часто ошибка там — не хватает скобки или запятой.";
  }

  // Подготовим человекочитаемое сообщение
  let humanMsg = "Ошибка парсинга итогового JSON";
  if (msg) humanMsg += ": " + msg;
  if (line != null) {
    humanMsg += ` (строка ${line}, столбец ${col})`;
  }

  // Рисуем строку с указателем
  let pointerLine = "";
  if (lineText) {
    const relativeCol = Math.max(1, col - (text.slice(0, index).lastIndexOf("\n") + 1));
    pointerLine = " ".repeat(relativeCol - 1) + "^";
    humanMsg += `\n\nСтрока ${line}:\n${lineText}\n${pointerLine}`;
  }

  if (hint) {
    humanMsg += `\n\nПодсказка: ${hint}`;
  }

  jsonStatus.textContent = humanMsg;
  jsonStatus.style.color = "#e74c3c";

  alert(humanMsg);
}


// --- УТИЛИТЫ JSON ---
function parseJsonOrAlert(text, fieldName, expectedType) {
  if (!text.trim()) return null;
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    alert("Ошибка парсинга " + fieldName + ":\n" + e.message);
    throw e;
  }

  if (expectedType === "object" && (typeof obj !== "object" || Array.isArray(obj) || obj === null)) {
    alert(fieldName + " должен быть JSON-объектом { ... }");
    throw new Error(fieldName + " is not object");
  }

  if (expectedType === "array" && !Array.isArray(obj)) {
    alert(fieldName + " должен быть JSON-массивом [ ... ]");
    throw new Error(fieldName + " is not array");
  }
  return obj;
}

function parseAnyJsonOrAlert(text, fieldName) {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    alert("Ошибка парсинга " + fieldName + ":\n" + e.message);
    throw e;
  }
}

function smartParseValue(str) {
  const trimmed = str.trim();
  if (!trimmed) return "";
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    return trimmed;
  }
}

function setDeep(obj, path, value) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    if (i === parts.length - 1) {
      current[key] = value;
    } else {
      if (!current[key] || typeof current[key] !== "object" || Array.isArray(current[key])) {
        current[key] = {};
      }
      current = current[key];
    }
  }
}

// --- ИТОГОВЫЙ JSON справа ---
function refreshTasksOutput() {
  tasksJsonEditor.value = JSON.stringify(tasks, null, 2);
  countTag.textContent = tasks.length + " объект" + (tasks.length === 1 ? "" : "ов");
  downloadBtn.disabled = tasks.length === 0;
  jsonStatus.textContent = "OK (сгенерировано конструктором)";
  jsonStatus.style.color = "#2ecc71";
}

downloadBtn.addEventListener("click", () => {
  const jsonStr = JSON.stringify(tasks, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "schedule.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

tasksJsonEditor.addEventListener("input", () => {
  jsonStatus.textContent = "Есть несохранённые правки (пока не применены)";
  jsonStatus.style.color = "#e67e22";
});

applyJsonBtn.addEventListener("click", () => {
  try {
    const text = tasksJsonEditor.value;
    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed)) {
      jsonStatus.textContent = "Ошибка: корневой JSON должен быть массивом [ ... ]";
      jsonStatus.style.color = "#e74c3c";
      alert("Корневой JSON должен быть массивом ( [ ... ] )");
      return;
    }

    // если всё ок – заменяем tasks и обновляем
    tasks.length = 0;
    parsed.forEach(obj => tasks.push(obj));
    refreshTasksOutput();
  } catch (e) {
    // Здесь вместо простого alert — подсветка места ошибки
    highlightJsonError(e, tasksJsonEditor);
  }
});


// --- QUERY BUILDER ---
function createQueryRow(fieldValue = "", valueValue = "") {
  const row = document.createElement("div");
  row.className = "kv-row query-row";

  const keyInput = document.createElement("input");
  keyInput.type = "text";
  keyInput.className = "kv-key";
  keyInput.placeholder = "Поле, напр. state, _id.$in, $or";
  keyInput.value = fieldValue;

  const valueInput = document.createElement("input");
  valueInput.type = "text";
  valueInput.className = "kv-value";
  valueInput.placeholder = 'Значение, напр. ACTIVE, [1,2], {"a":1}';
  valueInput.value = valueValue;

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "small-btn";
  removeBtn.textContent = "✕";
  removeBtn.title = "Удалить условие";
  removeBtn.addEventListener("click", () => {
    queryRowsContainer.removeChild(row);
    if (!queryRowsContainer.querySelector(".query-row")) {
      createQueryRow();
    }
    refreshQueryPreview();
  });

  keyInput.addEventListener("input", refreshQueryPreview);
  valueInput.addEventListener("input", refreshQueryPreview);

  row.appendChild(keyInput);
  row.appendChild(valueInput);
  row.appendChild(removeBtn);
  queryRowsContainer.appendChild(row);
}

function buildQueryObjectFromUI() {
  const rows = queryRowsContainer.querySelectorAll(".query-row");
  const result = {};
  let hasAny = false;

  rows.forEach((row) => {
    const keyInput = row.querySelector(".kv-key");
    const valueInput = row.querySelector(".kv-value");
    const key = keyInput.value.trim();
    const valStr = valueInput.value.trim();
    if (!key) return;
    hasAny = true;
    const parsedVal = valStr === "" ? "" : smartParseValue(valStr);
    setDeep(result, key, parsedVal);
  });

  return hasAny ? result : null;
}

function refreshQueryPreview() {
  const obj = buildQueryObjectFromUI();
  const toShow = obj || {};
  currentQueryPreview.textContent = JSON.stringify(toShow, null, 2);
}

addQueryRowBtn.addEventListener("click", () => {
  createQueryRow();
  refreshQueryPreview();
});

// --- ACTIONS DEFINITIONS ---
const ACTION_DEFS = {
  "addTask": {
    label: "addTask – создать отложенную задачу для пользователя:",
    fields: [
      { name: "actions", label: "actions", type: "json", required: true },
      { name: "count", label: "count", type: "number", required: false },
      { name: "datetime", label: "datetime", type: "string", required: false },
      { name: "datetime_format", label: "datetime_format", type: "string", required: false },
      { name: "exact_datetime", label: "exact_datetime", type: "boolean", required: false },
      { name: "from_start_of_day", label: "from_start_of_day", type: "boolean", required: false },
      { name: "interval", label: "interval", type: "json", required: false },
      { name: "offset", label: "offset", type: "json", required: false },
      { name: "send_on_weekend", label: "send_on_weekend", type: "boolean", required: false },
      { name: "stage_id", label: "stage_id", type: "number", required: false },
      { name: "state", label: "state", type: "string", required: false },
      { name: "substate", label: "substate", type: "string", required: false }
    ]
  },
  "answerCallbackQuery": {
    label: "answerCallbackQuery – ответ на нажатие inline-кнопки",
    fields: [
      { name: "cache_key", label: "cache_key", type: "string", required: false },
      { name: "cached", label: "cached", type: "boolean", required: false },
      { name: "show_alert", label: "show_alert", type: "boolean", required: false },
      { name: "text", label: "text", type: "string", required: false },
      { name: "url", label: "url", type: "string", required: false }
    ]
  },
  "clearCache": {
    label: "clearCache – удалить из кеша значение по ключу",
    fields: [
      { name: "key", label: "key", type: "string", required: false }
    ]
  },
  "clearUserCounters": {
    label: "clearUserCounters – удалить/обнулить несколько счётчиков сразу (по списку ID)",
    fields: [
      { name: "ids", label: "ids", type: "json", required: false }
    ]
  },
  "decreaseUserBalance": {
    label: "decreaseUserBalance – списать с баланса заданную сумму",
    fields: [
      { name: "amount", label: "amount", type: "number", required: false },
      { name: "currency", label: "currency", type: "string", required: false }
    ]
  },
  "decreaseUserCounter": {
    label: "decreaseUserCounter – уменьшить счётчик.",
    fields: [
      { name: "counter_id", label: "counter_id", type: "string", required: false },
      { name: "decrement", label: "decrement", type: "number", required: false },
      { name: "min_value", label: "min_value", type: "number", required: false },
      { name: "value", label: "value", type: "number", required: false }
    ]
  },
  "deleteBotCommands": {
    label: "deleteBotCommands – удалить все команды",
    fields: [
      { name: "language_code", label: "language_code", type: "string", required: false },
      { name: "scope", label: "scope", type: "json", required: false }
    ]
  },
  "deleteMessage": {
    label: "deleteMessage – удалить конкретное сообщение в чате",
    fields: [
      { name: "message_id", label: "message_id", type: "json", required: true },
      { name: "chat", label: "chat", type: "json", required: false }
    ]
  },
  "deleteUserCounter": {
    label: "deleteUserCounter – полностью удалить один счётчик",
    fields: [
      { name: "counter_id", label: "counter_id", type: "string", required: true }
    ]
  },
  "doDialog": {
    label: "doDialog – перейти в указанный диалог/сцену",
    fields: [
      { name: "dialog", label: "dialog", type: "string", required: false },
      { name: "ignore_state", label: "ignore_state", type: "boolean", required: false },
      { name: "start_new_context", label: "start_new_context", type: "boolean", required: false },
      { name: "vars", label: "vars", type: "json", required: false }
    ]
  },
  "doSwitch": {
    label: "doSwitch – переключиться на другую ветку сценария по “кейсу”",
    fields: [
      { name: "case", label: "case", type: "string", required: false },
      { name: "clear_history", label: "clear_history", type: "boolean", required: false }
    ]
  },
  "getMaxUserCounter": {
    label: "getMaxUserCounter – получить максимальное значение указанного счётчика",
    fields: [
      { name: "counter_id", label: "counter_id", type: "string", required: true }
    ]
  },
  "getMinUserCounter": {
    label: "getMinUserCounter – получить минимальное значение указанного счётчика",
    fields: [
      { name: "counter_id", label: "counter_id", type: "string", required: true }
    ]
  },
  "increaseUserBalance": {
    label: "increaseUserBalance – пополнить баланс пользователя на заданную сумму",
    fields: [
      { name: "amount", label: "amount", type: "number", required: false },
      { name: "currency", label: "currency", type: "string", required: false }
    ]
  },
  "increaseUserCounter": {
    label: "increaseUserCounter – увеличить числовой счётчик пользователя",
    fields: [
      { name: "counter_id", label: "counter_id", type: "string", required: false },
      { name: "increment", label: "increment", type: "number", required: false },
      { name: "max_value", label: "max_value", type: "number", required: false },
      { name: "value", label: "value", type: "number", required: false }
    ]
  },
  "insertBotCommand": {
    label: "insertBotCommand – добавить одну команду в список на нужную позицию",
    fields: [
      { name: "command", label: "command", type: "json", required: true },
      { name: "language_code", label: "language_code", type: "string", required: false },
      { name: "position", label: "position", type: "number", required: false },
      { name: "scope", label: "scope", type: "json", required: false }
    ]
  },
  "isMatch": {
    label: "isMatch – проверить соответствие входных данных с шаблоном",
    fields: [
      { name: "result_key", label: "result_key", type: "string", required: true },
      { name: "source", label: "source", type: "string", required: false },
      { name: "target", label: "target", type: "string", required: false }
    ]
  },
  "pullBotCommands": {
    label: "pullBotCommands – получить текущий список команд из Telegram",
    fields: [
      { name: "language_code", label: "language_code", type: "string", required: false },
      { name: "scope", label: "scope", type: "json", required: false }
    ]
  },
  "registerMessage": {
    label: "registerMessage – “зарегистрировать” сообщение в системе (сохранить его ID/контекст для дальнейших действий)",
    fields: [
      { name: "chat", label: "chat", type: "json", required: false },
      { name: "message_id", label: "message_id", type: "json", required: false }
    ]
  },
  "removeBotCommand": {
    label: "removeBotCommand – удалить одну конкретную команду из списка",
    fields: [
      { name: "command", label: "command", type: "string", required: true },
      { name: "force", label: "force", type: "boolean", required: false },
      { name: "language_code", label: "language_code", type: "string", required: false },
      { name: "scope", label: "scope", type: "json", required: false }
    ]
  },
  "resetUser": {
    label: "resetUser – “сбросить” пользователя",
    fields: [
      { name: "available_for_invites", label: "available_for_invites", type: "boolean", required: false },
      { name: "delete_cache", label: "delete_cache", type: "boolean", required: false },
      { name: "delete_counters", label: "delete_counters", type: "boolean", required: false },
      { name: "delete_state", label: "delete_state", type: "boolean", required: false },
      { name: "delete_substate", label: "delete_substate", type: "boolean", required: false },
      { name: "state", label: "state", type: "string", required: false },
      { name: "substate", label: "substate", type: "string", required: false }
    ]
  },
  "resetUserBalance": {
    label: "resetUserBalance – сбросить баланс (обычно до нуля или дефолтного значения)",
    fields: [
      { name: "currency", label: "currency", type: "string", required: false }
    ]
  },
  "resetUserCounter": {
    label: "resetUserCounter – сбросить один счётчик в начальное состояние",
    fields: [
      { name: "counter_id", label: "counter_id", type: "string", required: false }
    ]
  },
  "restoreUserState": {
    label: "restoreUserState – восстановить ранее сохранённый state",
    fields: [
      { name: "default_state", label: "default_state", type: "string", required: false }
    ]
  },
  "restoreUserSubstate": {
    label: "restoreUserSubstate – восстановить ранее сохранённый substate",
    fields: [
      { name: "default_substate", label: "default_substate", type: "string", required: false }
    ]
  },
  "saveToCache": {
    label: "saveToCache – сохранить произвольное значение в кеш по ключу",
    fields: [
      { name: "key", label: "key", type: "string", required: true },
      { name: "ttl", label: "ttl", type: "number", required: false },
      { name: "value", label: "value", type: "json", required: false }
    ]
  },
  "saveUserState": {
    label: "saveUserState – сохранить текущее состояние пользователя для последующего восстановления",
    fields: [
      { name: "state", label: "state", type: "string", required: false }
    ]
  },
  "saveUserSubstate": {
    label: "saveUserSubstate – сохранить текущее под-состояние",
    fields: [
      { name: "substate", label: "substate", type: "string", required: false }
    ]
  },
  "sendDocument": {
    label: "sendDocument – отправка файла (документа) с опциональным текстом/подписью",
    fields: [
      { name: "business_connection_id", label: "business_connection_id", type: "string", required: false },
      { name: "caption", label: "caption", type: "string", required: false },
      { name: "caption_entities", label: "caption_entities", type: "json", required: false },
      { name: "chat", label: "chat", type: "json", required: false },
      { name: "disable_content_type_detection", label: "disable_content_type_detection", type: "boolean", required: false },
      { name: "disable_notification", label: "disable_notification", type: "boolean", required: false },
      { name: "document", label: "document", type: "json", required: false },
      { name: "has_spoiler", label: "has_spoiler", type: "boolean", required: false },
      { name: "is_plain_text", label: "is_plain_text", type: "boolean", required: false },
      { name: "message_effect_id", label: "message_effect_id", type: "string", required: false },
      { name: "message_thread_id", label: "message_thread_id", type: "number", required: false },
      { name: "need_to_pin", label: "need_to_pin", type: "boolean", required: false },
      { name: "optional", label: "optional", type: "boolean", required: false },
      { name: "options", label: "options", type: "json", required: false },
      { name: "parse_mode", label: "parse_mode", type: "string", required: false },
      { name: "protect_content", label: "protect_content", type: "boolean", required: false },
      { name: "reply_button_callback_data", label: "reply_button_callback_data", type: "string", required: false },
      { name: "reply_button_caption", label: "reply_button_caption", type: "string", required: false },
      { name: "reply_markup", label: "reply_markup", type: "json", required: false },
      { name: "reply_parameters", label: "reply_parameters", type: "json", required: false },
      { name: "save_id_as", label: "save_id_as", type: "string", required: false },
      { name: "show_caption_above_media", label: "show_caption_above_media", type: "boolean", required: false },
      { name: "show_reply_button", label: "show_reply_button", type: "boolean", required: false },
      { name: "text", label: "text", type: "string", required: false },
      { name: "thumbnail", label: "thumbnail", type: "json", required: false }
    ]
  },
  "sendMessage": {
    label: "sendMessage – отправка текстового сообщения пользователю/в чат.",
    fields: [
      { name: "allow_paid_broadcast", label: "allow_paid_broadcast", type: "boolean", required: false },
      { name: "as_reply", label: "as_reply", type: "boolean", required: false },
      { name: "business_connection_id", label: "business_connection_id", type: "string", required: false },
      { name: "chat", label: "chat", type: "json", required: false },
      { name: "disable_notification", label: "disable_notification", type: "boolean", required: false },
      { name: "entities", label: "entities", type: "json", required: false },
      { name: "is_plain_text", label: "is_plain_text", type: "boolean", required: false },
      { name: "link_preview_options", label: "link_preview_options", type: "json", required: false },
      { name: "max_length", label: "max_length", type: "number", required: false },
      { name: "message_effect_id", label: "message_effect_id", type: "string", required: false },
      { name: "message_thread_id", label: "message_thread_id", type: "number", required: false },
      { name: "need_to_pin", label: "need_to_pin", type: "boolean", required: false },
      { name: "optional", label: "optional", type: "boolean", required: false },
      { name: "options", label: "options", type: "json", required: false },
      { name: "parse_mode", label: "parse_mode", type: "string", required: false },
      { name: "protect_content", label: "protect_content", type: "boolean", required: false },
      { name: "reply_button_callback_data", label: "reply_button_callback_data", type: "string", required: false },
      { name: "reply_button_caption", label: "reply_button_caption", type: "string", required: false },
      { name: "reply_markup", label: "reply_markup", type: "json", required: false },
      { name: "reply_parameters", label: "reply_parameters", type: "json", required: false },
      { name: "show_reply_button", label: "show_reply_button", type: "boolean", required: false },
      { name: "text", label: "text", type: "string", required: false }
    ]
  },
  "sendPhoto": {
    label: "sendPhoto – отправка фотографии с подписью/без",
    fields: [
      { name: "business_connection_id", label: "business_connection_id", type: "string", required: false },
      { name: "caption", label: "caption", type: "string", required: false },
      { name: "caption_entities", label: "caption_entities", type: "json", required: false },
      { name: "chat", label: "chat", type: "json", required: false },
      { name: "disable_notification", label: "disable_notification", type: "boolean", required: false },
      { name: "has_spoiler", label: "has_spoiler", type: "boolean", required: false },
      { name: "is_plain_text", label: "is_plain_text", type: "boolean", required: false },
      { name: "message_effect_id", label: "message_effect_id", type: "string", required: false },
      { name: "message_thread_id", label: "message_thread_id", type: "number", required: false },
      { name: "need_to_pin", label: "need_to_pin", type: "boolean", required: false },
      { name: "optional", label: "optional", type: "boolean", required: false },
      { name: "options", label: "options", type: "json", required: false },
      { name: "parse_mode", label: "parse_mode", type: "string", required: false },
      { name: "photo", label: "photo", type: "json", required: false },
      { name: "protect_content", label: "protect_content", type: "boolean", required: false },
      { name: "reply_button_callback_data", label: "reply_button_callback_data", type: "string", required: false },
      { name: "reply_button_caption", label: "reply_button_caption", type: "string", required: false },
      { name: "reply_markup", label: "reply_markup", type: "json", required: false },
      { name: "reply_parameters", label: "reply_parameters", type: "json", required: false },
      { name: "show_caption_above_media", label: "show_caption_above_media", type: "boolean", required: false },
      { name: "show_reply_button", label: "show_reply_button", type: "boolean", required: false },
      { name: "text", label: "text", type: "string", required: false }
    ]
  },
  "sendVideo": {
    label: "sendVideo – отправка видео с подписью/без.",
    fields: [
      { name: "business_connection_id", label: "business_connection_id", type: "string", required: false },
      { name: "caption", label: "caption", type: "string", required: false },
      { name: "caption_entities", label: "caption_entities", type: "json", required: false },
      { name: "chat", label: "chat", type: "json", required: false },
      { name: "disable_notification", label: "disable_notification", type: "boolean", required: false },
      { name: "has_spoiler", label: "has_spoiler", type: "boolean", required: false },
      { name: "is_plain_text", label: "is_plain_text", type: "boolean", required: false },
      { name: "message_effect_id", label: "message_effect_id", type: "string", required: false },
      { name: "message_thread_id", label: "message_thread_id", type: "number", required: false },
      { name: "need_to_pin", label: "need_to_pin", type: "boolean", required: false },
      { name: "optional", label: "optional", type: "boolean", required: false },
      { name: "options", label: "options", type: "json", required: false },
      { name: "parse_mode", label: "parse_mode", type: "string", required: false },
      { name: "protect_content", label: "protect_content", type: "boolean", required: false },
      { name: "reply_button_callback_data", label: "reply_button_callback_data", type: "string", required: false },
      { name: "reply_button_caption", label: "reply_button_caption", type: "string", required: false },
      { name: "reply_markup", label: "reply_markup", type: "json", required: false },
      { name: "reply_parameters", label: "reply_parameters", type: "json", required: false },
      { name: "show_caption_above_media", label: "show_caption_above_media", type: "boolean", required: false },
      { name: "show_reply_button", label: "show_reply_button", type: "boolean", required: false },
      { name: "supports_streaming", label: "supports_streaming", type: "boolean", required: false },
      { name: "text", label: "text", type: "string", required: false },
      { name: "thumbnail", label: "thumbnail", type: "json", required: false },
      { name: "video", label: "video", type: "json", required: false }
    ]
  },
  "setBotCommands": {
    label: "setBotCommands — установить список команд",
    fields: [
      { name: "commands", label: "commands", type: "json", required: true },
      { name: "language_code", label: "language_code", type: "string", required: false },
      { name: "scope", label: "scope", type: "json", required: false }
    ]
  },
  "setCache": {
    label: "setCache – то же самое, что saveToCache, но более “низкоуровневый”",
    fields: [
      { name: "key", label: "key", type: "string", required: true },
      { name: "ttl", label: "ttl", type: "number", required: false },
      { name: "value", label: "value", type: "json", required: false }
    ]
  },
  "setChannel": {
    label: "setChannel – указать канал/чат, от имени которого дальше выполнять действия",
    fields: [
      { name: "chat", label: "chat", type: "json", required: false },
      { name: "id", label: "id", type: "string", required: false }
    ]
  },
  "setDelay": {
    label: "setDelay – поставить задержку",
    fields: [
      { name: "chat_action", label: "chat_action", type: "string", required: false },
      { name: "delay", label: "delay", type: "number", required: false }
    ]
  },
  "setRoute": {
    label: "setRoute – задать маршрут/путь обработки пользователя",
    fields: [
      { name: "route", label: "route", type: "string", required: true }
    ]
  },
  "setUserAttribute": {
    label: "setUserAttribute – записать произвольный пользовательский атрибут",
    fields: [
      { name: "name", label: "name", type: "string", required: true },
      { name: "value", label: "value", type: "json", required: true }
    ]
  },
  "setUserBalance": {
    label: "setUserBalance – задать балансу конкретное значение (жёстко)",
    fields: [
      { name: "amount", label: "amount", type: "number", required: false },
      { name: "currency", label: "currency", type: "string", required: false }
    ]
  },
  "setUserCounter": {
    label: "setUserCounter – установить конкретное значение счётчика",
    fields: [
      { name: "counter_id", label: "counter_id", type: "string", required: true },
      { name: "value", label: "value", type: "number", required: false }
    ]
  },
  "setUserState": {
    label: "setUserState – установить основное состояние пользователя",
    fields: [
      { name: "state", label: "state", type: "string", required: true }
    ]
  },
  "setUserSubstate": {
    label: "setUserSubstate – установить под-состояние",
    fields: [
      { name: "substate", label: "substate", type: "string", required: true }
    ]
  },
  "getUserById": {
    label: "getUserById – получить информацию о пользователе по его id",
    fields: [
      { name: "user_id", label: "user_id", type: "string", required: true }
    ]
  },
  "shufflePeers": {
    label: "shufflePeers —  перемешать пользователей",
    fields: [
      { name: "query", label: "query (JSON)", type: "json", required: true },
      { name: "count_links", label: "count_links", type: "number", required: true },
      { name: "link_name_prefix", label: "link_name_prefix", type: "string", required: true },
      { name: "backward_link_name_prefix", label: "backward_link_name_prefix", type: "string", required: true },
      { name: "need_backward_links", label: "need_backward_links", type: "boolean", required: false }
    ]
  }
};

// Основные (смысловые) поля по методам, которые показываем сразу.
// Остальные уедут в "Дополнительные поля".
const ACTION_MAIN_FIELDS = {
  // Telegram-like методы

  sendMessage: ["text"],                // chat/id берём из контекста, text — смысл
  sendDocument: ["document"],           // в твоём формате это объект с file_id
  sendPhoto: ["photo"],
  sendVideo: ["video"],
  sendAudio: ["audio"],
  sendVoice: ["voice"],
  sendVideoNote: ["video_note"],
  sendSticker: ["sticker"],

  answerCallbackQuery: ["text"],        // формально в Bot API обязателен callback_query_id, но он у тебя из контекста

  setBotCommands: ["commands"],         // список команд — главное
  deleteBotCommands: [],                // всё по сути доп-настройки (scope/language) — поле можно не показывать вообще
  pullBotCommands: [],

  insertBotCommand: ["command"],        // сам описатель команды
  removeBotCommand: ["command"],

  // Твои "диалоговые" / вспомогательные методы

  doDialog: ["dialog"],                 // ключ диалога
  setDelay: ["chat_action", "delay"],   // оба логически важны
  sendMediaGroup: ["media"],            // если такой метод есть в твоём ACTION_DEFS

  setUserState: ["state"],
  setUserSubstate: ["substate"],
  saveUserState: ["state"],             // если поле есть
  saveUserSubstate: ["substate"],
  restoreUserState: [],
  restoreUserSubstate: [],

  setUserAttribute: ["name", "value"],
  setCache: ["key", "value"],
  saveToCache: ["key", "value"],
  clearCache: ["key"],

  increaseUserCounter: ["counter_id"],
  decreaseUserCounter: ["counter_id"],
  setUserCounter: ["counter_id", "value"],
  deleteUserCounter: ["counter_id"],
  clearUserCounters: ["ids"],

  increaseUserBalance: ["amount"],
  decreaseUserBalance: ["amount"],
  setUserBalance: ["amount"],
  resetUserBalance: [],

  resetUser: ["state", "substate"],     // можно будет сбросить только состояние

  setRoute: ["route"],
  setChannel: ["id"],

  registerMessage: ["message_id"],
  deleteMessage: ["message_id"],

  isMatch: ["source", "target"],
  getMaxUserCounter: ["counter_id"],
  getMinUserCounter: ["counter_id"],

  getUserById: ["user_id"],

  shufflePeers: ["query", "count_links"],

  addTask: ["actions", "datetime"],     // по смыслу: что делать и когда
};

// Подсказки по полям options.
// Ключ: "<имя_экшена>.<имя_поля>"
const ACTION_PLACEHOLDER_HINTS = {
  // --- sendMessage ---
  "sendMessage.text": "Текст сообщения пользователю",
  "sendMessage.parse_mode": "HTML / Markdown / MarkdownV2",
  "sendMessage.chat": "JSON с chat_id или username получателя",
  "sendMessage.reply_markup": "JSON разметка клавиатуры Telegram",
  "sendMessage.entities": "JSON сущностей (bold, url и т.п.)",
  "sendMessage.link_preview_options": "Настройки превью ссылок (JSON)",
  "sendMessage.allow_paid_broadcast": "Разрешить платную рассылку (true/false)",

  // --- sendDocument ---
  "sendDocument.text": "Текст рядом с файлом",
  "sendDocument.document": "JSON документа (file_id / url / file)",
  "sendDocument.document.file_id": "file_id документа (если внутренняя ссылка)",
  "sendDocument.caption": "Подпись к документу",
  "sendDocument.chat": "JSON с chat_id или username получателя",
  "sendDocument.reply_markup": "JSON разметка клавиатуры Telegram",

  // --- sendPhoto ---
  "sendPhoto.photo": "JSON с фото (file_id / url / file)",
  "sendPhoto.caption": "Подпись к фото",
  "sendPhoto.text": "Доп. текст к фото",
  "sendPhoto.chat": "JSON с chat_id или username получателя",

  // --- sendVideo ---
  "sendVideo.video": "JSON с видео (file_id / url / file)",
  "sendVideo.caption": "Подпись к видео",
  "sendVideo.supports_streaming": "true, если видео можно смотреть как стрим",

  // --- setDelay ---
  "setDelay.delay": "Задержка в миллисекундах перед следующим action",
  "setDelay.chat_action": "typing / upload_document / upload_photo / ...",

  // --- doDialog ---
  "doDialog.dialog": "Имя диалога, напр. homework1.OPEN_HOMEWORK1_SESSION",
  "doDialog.ignore_state": "Игнорировать текущее state при переходе",
  "doDialog.start_new_context": "Начать новый контекст",
  "doDialog.vars": "JSON переменных, передаваемых в диалог",

  // --- setBotCommands / insertBotCommand / removeBotCommand ---
  "setBotCommands.commands": "JSON массив команд бота",
  "setBotCommands.scope": "JSON scope команд (по умолчанию all_private_chats)",
  "setBotCommands.language_code": "Код языка, напр. ru",

  "insertBotCommand.command": "JSON описания одной команды (command, description)",
  "insertBotCommand.position": "Позиция команды в списке (0,1,2,...)",
  "insertBotCommand.scope": "JSON scope команд",
  "insertBotCommand.language_code": "Код языка команды",

  "removeBotCommand.command": "Имя команды без слэша, напр. send_homework",
  "removeBotCommand.scope": "JSON scope команд",
  "removeBotCommand.language_code": "Код языка команды",
  "removeBotCommand.force": "Удалять даже если в нескольких scope (true/false)",

  "deleteBotCommands.scope": "JSON scope для удаления всех команд",
  "deleteBotCommands.language_code": "Код языка, для которого удаляем команды",

  // --- setUserState/Substate ---
  "setUserState.state": "Новое значение user.state",
  "setUserSubstate.substate": "Новое значение user.substate",

  "saveUserState.state": "Сохранить пользовательское состояние (state)",
  "saveUserSubstate.substate": "Сохранить под-состояние (substate)",

  "restoreUserState.default_state": "Какое значение использовать, если нет сохранённого state",
  "restoreUserSubstate.default_substate": "Какое значение использовать, если нет сохранённого substate",

  // --- Counters / Balance ---
  "increaseUserCounter.counter_id": "Идентификатор счётчика (строка)",
  "increaseUserCounter.increment": "На сколько увеличить счётчик",
  "increaseUserCounter.max_value": "Максимальное значение счётчика",
  "increaseUserCounter.value": "Явное новое значение счётчика",

  "decreaseUserCounter.counter_id": "Идентификатор счётчика (строка)",
  "decreaseUserCounter.decrement": "На сколько уменьшить счётчик",
  "decreaseUserCounter.min_value": "Минимальное значение счётчика",
  "decreaseUserCounter.value": "Явное новое значение счётчика",

  "setUserCounter.counter_id": "Идентификатор счётчика",
  "setUserCounter.value": "Новое значение счётчика",

  "getMaxUserCounter.counter_id": "ID счётчика, для которого ищем максимум",
  "getMinUserCounter.counter_id": "ID счётчика, для которого ищем минимум",

  "clearUserCounters.ids": "JSON массив ID счётчиков для очистки",

  "increaseUserBalance.amount": "Сколько прибавить к балансу",
  "increaseUserBalance.currency": "Код валюты, напр. RUB",
  "decreaseUserBalance.amount": "Сколько списать с баланса",
  "decreaseUserBalance.currency": "Код валюты, напр. RUB",
  "setUserBalance.amount": "Явное новое значение баланса",
  "setUserBalance.currency": "Код валюты, напр. RUB",
  "resetUserBalance.currency": "Код валюты (если нужно сбросить для конкретной)",

  // --- Cache ---
  "setCache.key": "Ключ в кэше",
  "setCache.ttl": "Время жизни в секундах",
  "setCache.value": "Значение (любое JSON)",

  "saveToCache.key": "Ключ в кэше",
  "saveToCache.ttl": "Время жизни в секундах",
  "saveToCache.value": "Значение (любое JSON)",

  "clearCache.key": "Какой ключ удалить из кэша",

  // --- setUserAttribute ---
  "setUserAttribute.name": "Имя пользовательского атрибута",
  "setUserAttribute.value": "Значение (любое JSON)",

  // --- Route / Channel ---
  "setRoute.route": "Имя маршрута / сценария",
  "setChannel.id": "ID канала / чата",
  "setChannel.chat": "JSON с данными о чате",

  // --- answerCallbackQuery ---
  "answerCallbackQuery.text": "Текст для всплывающего уведомления",
  "answerCallbackQuery.show_alert": "true — показать алерт, false — обычный toast",
  "answerCallbackQuery.url": "URL для перехода по callback",
  "answerCallbackQuery.cached": "Использовать кэшированный ответ",
  "answerCallbackQuery.cache_key": "Ключ кэша для ответа",

  // --- deleteMessage / registerMessage ---
  "deleteMessage.message_id": "JSON с message_id для удаления",
  "deleteMessage.chat": "JSON с чатом, если не текущий",
  "registerMessage.message_id": "JSON с message_id, который нужно зарегистрировать",
  "registerMessage.chat": "JSON с чатом, если не текущий",

  // --- resetUser ---
  "resetUser.state": "Новое состояние (state) пользователя",
  "resetUser.substate": "Новое под-состояние (substate)",
  "resetUser.delete_cache": "Удалить кэш пользователя",
  "resetUser.delete_counters": "Удалить все счётчики",
  "resetUser.delete_state": "Удалить state",
  "resetUser.delete_substate": "Удалить substate",
  "resetUser.available_for_invites": "Может ли участвовать в инвайтах",

  // --- isMatch ---
  "isMatch.result_key": "Ключ в кэше/контексте для результата сравнения",
  "isMatch.source": "Строка-источник",
  "isMatch.target": "Строка-цель для сравнения",

  // --- addTask ---
  "addTask.actions": "JSON массив actions, которые будут выполнены задачей",
  "addTask.datetime": "Строка даты/времени запуска (см. формат в доке)",
  "addTask.datetime_format": "Формат datetime, если используется парсинг строки",
  "addTask.interval": "JSON с интервалом повторения",
  "addTask.offset": "JSON со смещением от текущего момента",
  "addTask.send_on_weekend": "Можно ли отправлять задачи по выходным",
  "addTask.exact_datetime": "true — строго по указанному времени",
  "addTask.count": "Сколько раз выполнить задачу",
  "addTask.state": "state пользователя, в котором будет выполняться задача",
  "addTask.substate": "substate пользователя, в котором будет выполняться задача",

  // --- setBotCommands / pullBotCommands / deleteBotCommands ---
  "pullBotCommands.scope": "JSON scope, откуда тянуть команды",
  "pullBotCommands.language_code": "Язык команд, напр. ru",

  // --- setChannel / registerMessage / deleteMessage уже покрыты выше ---

  // --- setUserState / setUserSubstate / save/restore уже покрыты выше ---

  // --- setCache / saveToCache уже покрыты выше ---

  // --- custom ---
  "getUserById.user_id": "ID пользователя (может быть из links, например {{user.links.user2_0}})",

  "shufflePeers.query": "JSON-фильтр пользователей для распределения",
  "shufflePeers.count_links": "Сколько пиров назначать каждому пользователю",
  "shufflePeers.link_name_prefix": "Префикс для ссылки на ревьюера, напр. reviewer_",
  "shufflePeers.backward_link_name_prefix": "Префикс для обратной ссылки, напр. user_",
  "shufflePeers.need_backward_links": "Нужны ли обратные ссылки (true/false)"
};


function populateActionTypes() {
  Object.entries(ACTION_DEFS).forEach(([name, def]) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = def.label || (name);
    actionTypeSelect.appendChild(opt);
  });
}


function renderActionFields() {
  actionFieldsContainer.innerHTML = "";
  const type = actionTypeSelect.value;
  const def = ACTION_DEFS[type];
  if (!def) return;

  // 1. Определяем, какие поля считаем основными
  const explicitMain = ACTION_MAIN_FIELDS[type];

  let mainFieldNames;
  if (Array.isArray(explicitMain)) {
    mainFieldNames = explicitMain;
  } else {
    const requiredFields = def.fields.filter(f => f.required);
    if (requiredFields.length > 0) {
      mainFieldNames = requiredFields.map(f => f.name);
    } else {
      // Нет явных "основных" и нет required — показываем все как основные
      mainFieldNames = def.fields.map(f => f.name);
    }
  }

  const mainFields = def.fields.filter(f => mainFieldNames.includes(f.name));
  const optionalFields = def.fields.filter(f => !mainFieldNames.includes(f.name));

  // Вспомогательная функция для создания одного поля
  function createFieldElement(f, isRequired, isOptional) {
    const wrapper = document.createElement("div");
    wrapper.className = "field";

    const label = document.createElement("label");
    label.textContent = f.label || f.name;
    if (isRequired) label.textContent += " *";

    const hint = document.createElement("div");
    hint.className = "inline-hint";

    const hintKey = type + "." + f.name;
    const resolvedPlaceholder =
      ACTION_PLACEHOLDER_HINTS[hintKey] ||
      f.placeholder ||
      (isRequired
        ? "Обязательное поле " + f.name
        : (isOptional ? "Необязательное поле " + f.name : "Поле " + f.name));

    hint.textContent = resolvedPlaceholder;

    let input;
    if (f.type === "string" || f.type === "number") {
      input = document.createElement("input");
      input.type = f.type === "number" ? "number" : "text";
      input.placeholder = resolvedPlaceholder;
    } else if (f.type === "boolean") {
      input = document.createElement("select");
      const optEmpty = document.createElement("option");
      optEmpty.value = "";
      optEmpty.textContent = isRequired ? "выбери значение" : "не задавать";
      const optTrue = document.createElement("option");
      optTrue.value = "true";
      optTrue.textContent = "true";
      const optFalse = document.createElement("option");
      optFalse.value = "false";
      optFalse.textContent = "false";
      input.appendChild(optEmpty);
      input.appendChild(optTrue);
      input.appendChild(optFalse);
    } else if (f.type === "json") {
      input = document.createElement("textarea");
      input.rows = 3;
      input.placeholder = resolvedPlaceholder;
    } else {
      // fallback: строка
      input = document.createElement("input");
      input.type = "text";
      input.placeholder = resolvedPlaceholder;
    }

    input.dataset.fieldName = f.name;

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    wrapper.appendChild(hint);

    return wrapper;
  }

  // --- Основные поля (показываем сразу) ---
  mainFields.forEach(f => {
    const el = createFieldElement(f, !!f.required, false);
    actionFieldsContainer.appendChild(el);
  });

  // --- Необязательные в скрытом блоке ---
  if (optionalFields.length > 0) {
    const optionalWrapper = document.createElement("div");
    optionalWrapper.className = "optional-wrapper";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "secondary small-btn optional-toggle";
    toggleBtn.textContent = "Показать дополнительные поля (не обязательны)";

    const optionalFieldsBox = document.createElement("div");
    optionalFieldsBox.className = "optional-fields hidden";

    const info = document.createElement("div");
    info.className = "inline-hint";
    info.textContent = "Поля ниже — не обязательные. Заполняй только то, что реально нужно.";
    optionalFieldsBox.appendChild(info);

    optionalFields.forEach(f => {
      const el = createFieldElement(f, !!f.required, true);
      optionalFieldsBox.appendChild(el);
    });

    toggleBtn.addEventListener("click", () => {
      const isHidden = optionalFieldsBox.classList.contains("hidden");
      optionalFieldsBox.classList.toggle("hidden", !isHidden);
      toggleBtn.textContent = isHidden
        ? "Скрыть дополнительные поля"
        : "Показать дополнительные поля (не обязательны)";
    });

    optionalWrapper.appendChild(toggleBtn);
    optionalWrapper.appendChild(optionalFieldsBox);
    actionFieldsContainer.appendChild(optionalWrapper);
  }
}
function buildActionFromForm() {
  const type = actionTypeSelect.value;
  const def = ACTION_DEFS[type];
  if (!def) {
    alert("Не выбран тип action");
    return null;
  }

  const optionsObj = {};

  for (const f of def.fields) {
    const el = actionFieldsContainer.querySelector(
      '[data-field-name="' + f.name + '"]'
    );
    if (!el) continue;

    const fieldLabel = f.label || f.name;
    const raw = (el.tagName === "TEXTAREA" ? el.value : el.value).trim();

    // --- Проверка на обязательные поля (для любых типов) ---
    if (!raw) {
      if (f.required) {
        alert('Поле "' + fieldLabel + '" обязательно для ' + type);
        return null;
      }
      // необязательное и пустое — просто не пишем его в options
      continue;
    }

    let value;

    if (f.type === "string") {
      value = raw;

    } else if (f.type === "number") {
      const num = Number(raw);
      if (Number.isNaN(num)) {
        alert('Поле "' + fieldLabel + '" должно быть числом');
        return null;
      }
      value = num;

    } else if (f.type === "boolean") {
      // ожидаем "true" или "false" из select
      if (raw !== "true" && raw !== "false") {
        alert('Поле "' + fieldLabel + '" должно быть true/false');
        return null;
      }
      value = raw === "true";

    } else if (f.type === "json") {
      // тут уже внутри parseAnyJsonOrAlert будет alert с понятным текстом
      value = parseAnyJsonOrAlert(raw, "JSON в поле " + fieldLabel);

    } else {
      // fallback: строка
      value = raw;
    }

    setDeep(optionsObj, f.name, value);
  }

  const actionObj = { action: type };
  if (Object.keys(optionsObj).length > 0) {
    actionObj.options = optionsObj;
  }

  return actionObj;
}

function refreshCurrentActionsPreview() {
  currentActionsPreview.textContent = JSON.stringify(currentActions, null, 2);
}

addActionBtn.addEventListener("click", () => {
  const actionObj = buildActionFromForm();
  if (!actionObj) return;

  // добавляем action в массив текущего блока
  currentActions.push(actionObj);
  refreshCurrentActionsPreview();

  // просто перерисовываем форму для текущего типа action:
  // обязательные поля станут пустыми, доп. поля снова свернутся
  renderActionFields();
});


clearActionsBtn.addEventListener("click", () => {
  if (!currentActions.length) return;
  const ok = confirm("Очистить actions для текущего блока?");
  if (!ok) return;
  currentActions = [];
  refreshCurrentActionsPreview();
});

actionTypeSelect.addEventListener("change", () => {
  renderActionFields();
});

// --- РАБОТА С БЛОКОМ ---
function clearBlockForm() {
  descriptionInput.value = "";
  scheduleInput.value = "";
  datetimeInput.value = "";
  isActiveInput.checked = false;
  extraInput.value = "";

  // Query
  queryRowsContainer.innerHTML = "";
  createQueryRow();
  refreshQueryPreview();

  // Actions
  currentActions = [];
  refreshCurrentActionsPreview();
  actionTypeSelect.selectedIndex = 0;
  renderActionFields();
}

addBlockBtn.addEventListener("click", () => {
  try {
    const block = {};

    const description = descriptionInput.value.trim();
    if (description) block.description = description;

    const scheduleValue = scheduleInput.value;
    if (scheduleValue) {
      const iso = new Date(scheduleValue).toISOString();
      block.schedule_datetime = iso;
    }

    const datetimeValue = datetimeInput.value;
    if (datetimeValue) {
      const iso = new Date(datetimeValue).toISOString();
      block.datetime = iso;
    }

    if (isActiveInput.checked) block.is_active = true;

    const queryObj = buildQueryObjectFromUI();
    if (queryObj) block.query = queryObj;

    if (currentActions.length > 0) {
      block.actions = JSON.parse(JSON.stringify(currentActions));
    }

    const extraJson = parseJsonOrAlert(extraInput.value, "Дополнительные поля блока", "object");
    if (extraJson) Object.assign(block, extraJson);

    if (!block.description && !block.query && !block.actions) {
      const proceed = confirm("Похоже, блок пустой (нет description, query, actions). Всё равно добавить?");
      if (!proceed) return;
    }

    tasks.push(block);
    refreshTasksOutput();
    clearBlockForm();
  } catch (e) {
    // Ошибки уже показаны alert'ами.
  }
});

clearBlockFormBtn.addEventListener("click", () => {
  const ok = confirm("Очистить форму текущего блока?");
  if (!ok) return;
  clearBlockForm();
});

clearAllBlocksBtn.addEventListener("click", () => {
  if (!tasks.length) return;
  const ok = confirm("Точно очистить ВСЕ блоки в итоговом JSON?");
  if (!ok) return;
  tasks.length = 0;
  refreshTasksOutput();
});

// --- ИНИЦИАЛИЗАЦИЯ ---
populateActionTypes();
renderActionFields();
createQueryRow();
refreshQueryPreview();
refreshTasksOutput();
