"use strict";

const elements = {
  form: document.querySelector("#settingsForm"),
  rows: document.querySelector("#rowsInput"),
  cols: document.querySelector("#colsInput"),
  mines: document.querySelector("#minesInput"),
  mineLimit: document.querySelector("#mineLimit"),
  formError: document.querySelector("#formError"),
  pressPreview: document.querySelector("#pressPreviewInput"),
  board: document.querySelector("#board"),
  remainingMines: document.querySelector("#remainingMines"),
  timer: document.querySelector("#timer"),
  statusText: document.querySelector("#statusText"),
  statusIcon: document.querySelector("#statusIcon"),
  restart: document.querySelector("#restartButton"),
  modeButtons: [...document.querySelectorAll(".mode-button")],
  timingButtons: [...document.querySelectorAll(".timing-button")],
  overlay: document.querySelector("#resultOverlay"),
  resultEmoji: document.querySelector("#resultEmoji"),
  resultTitle: document.querySelector("#resultTitle"),
  resultDetail: document.querySelector("#resultDetail"),
  playAgain: document.querySelector("#playAgainButton"),
  closeResult: document.querySelector("#closeResultButton"),
};

const state = {
  rows: 9,
  cols: 9,
  mines: 10,
  cells: [],
  started: false,
  ended: false,
  flags: 0,
  revealedSafe: 0,
  elapsed: 0,
  timerId: null,
  inputMode: "reveal",
  pressPreview: true,
  revealTiming: "release",
  suppressClickCell: null,
};

function createCell(row, col) {
  return {
    row,
    col,
    isMine: false,
    isRevealed: false,
    isFlagged: false,
    adjacent: 0,
    element: null,
  };
}

function readInteger(input) {
  if (input.value.trim() === "") return NaN;
  return Number(input.value);
}

function updateMineLimit() {
  const rows = readInteger(elements.rows);
  const cols = readInteger(elements.cols);
  const total = Number.isInteger(rows) && Number.isInteger(cols) && rows > 0 && cols > 0
    ? rows * cols
    : 0;
  elements.mines.max = String(total);
  elements.mineLimit.textContent = `/ ${total}`;
}

function validateSettings() {
  const rows = readInteger(elements.rows);
  const cols = readInteger(elements.cols);
  const mines = readInteger(elements.mines);

  if (!Number.isInteger(rows) || rows < 2 || rows > 30) {
    return { error: "高度必须是 2 到 30 之间的整数。" };
  }
  if (!Number.isInteger(cols) || cols < 2 || cols > 30) {
    return { error: "宽度必须是 2 到 30 之间的整数。" };
  }
  if (!Number.isInteger(mines) || mines < 0 || mines > rows * cols) {
    return { error: `雷数必须是 0 到 ${rows * cols} 之间的整数。` };
  }
  return { rows, cols, mines };
}

function setStatus(text, icon) {
  elements.statusText.textContent = text;
  elements.statusIcon.textContent = icon;
}

function stopTimer() {
  window.clearInterval(state.timerId);
  state.timerId = null;
}

function startTimer() {
  if (state.timerId || state.ended) return;
  state.timerId = window.setInterval(() => {
    state.elapsed += 1;
    elements.timer.textContent = String(state.elapsed);
  }, 1000);
}

function updateCounters() {
  elements.remainingMines.textContent = String(state.mines - state.flags);
  elements.timer.textContent = String(state.elapsed);
}

function renderBoard() {
  elements.board.replaceChildren();
  elements.board.style.gridTemplateColumns = `repeat(${state.cols}, var(--cell-size))`;
  const fragment = document.createDocumentFragment();

  for (const cell of state.cells) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.dataset.row = String(cell.row);
    button.dataset.col = String(cell.col);
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `第 ${cell.row + 1} 行，第 ${cell.col + 1} 列，未翻开`);
    cell.element = button;
    fragment.append(button);
  }
  elements.board.append(fragment);
}

function newGame(config = { rows: state.rows, cols: state.cols, mines: state.mines }) {
  stopTimer();
  state.rows = config.rows;
  state.cols = config.cols;
  state.mines = config.mines;
  state.cells = [];
  state.started = false;
  state.ended = false;
  state.flags = 0;
  state.revealedSafe = 0;
  state.elapsed = 0;
  state.suppressClickCell = null;

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      state.cells.push(createCell(row, col));
    }
  }

  elements.overlay.hidden = true;
  elements.formError.textContent = "";
  setStatus("准备开始", "🙂");
  updateCounters();
  renderBoard();
}

function getCell(row, col) {
  if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return null;
  return state.cells[row * state.cols + col];
}

function getNeighbors(cell) {
  const neighbors = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const neighbor = getCell(cell.row + rowOffset, cell.col + colOffset);
      if (neighbor) neighbors.push(neighbor);
    }
  }
  return neighbors;
}

function placeMines(firstCell) {
  const candidates = state.cells.filter((cell) => state.mines === state.cells.length || cell !== firstCell);

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [candidates[index], candidates[randomIndex]] = [candidates[randomIndex], candidates[index]];
  }

  for (let index = 0; index < state.mines; index += 1) {
    candidates[index].isMine = true;
  }

  for (const cell of state.cells) {
    if (!cell.isMine) {
      cell.adjacent = getNeighbors(cell).filter((neighbor) => neighbor.isMine).length;
    }
  }
}

function beginOn(firstCell) {
  placeMines(firstCell);
  state.started = true;
  setStatus("排雷中", "😐");
  startTimer();
}

function revealVisual(cell) {
  cell.element.classList.add("revealed");
  cell.element.setAttribute("aria-label", `第 ${cell.row + 1} 行，第 ${cell.col + 1} 列，${cell.adjacent || "空白"}`);
  if (cell.adjacent > 0) {
    cell.element.textContent = String(cell.adjacent);
    cell.element.classList.add(`number-${cell.adjacent}`);
  }
}

function revealSafeArea(initialCell) {
  const queue = [initialCell];
  const queued = new Set([initialCell]);

  while (queue.length > 0) {
    const cell = queue.shift();
    if (cell.isRevealed || cell.isFlagged || cell.isMine) continue;

    cell.isRevealed = true;
    state.revealedSafe += 1;
    revealVisual(cell);

    if (cell.adjacent === 0) {
      for (const neighbor of getNeighbors(cell)) {
        if (!queued.has(neighbor) && !neighbor.isMine && !neighbor.isFlagged) {
          queued.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }
}

function showAllMines(explodedCell = null) {
  for (const cell of state.cells) {
    if (cell.isMine) {
      cell.element.textContent = "✹";
      cell.element.classList.add("revealed", "mine");
      if (cell === explodedCell) cell.element.classList.add("exploded");
    } else if (cell.isFlagged) {
      cell.element.textContent = "×";
      cell.element.classList.add("wrong-flag");
    }
  }
}

function showResult(won) {
  elements.resultEmoji.textContent = won ? "🏆" : "💥";
  elements.resultTitle.textContent = won ? "排雷成功" : "踩雷了";
  elements.resultDetail.textContent = won
    ? `${state.rows} × ${state.cols} 棋盘，${state.mines} 颗雷，用时 ${state.elapsed} 秒。`
    : "雷区已经全部显示，调整策略再试一次。";
  window.setTimeout(() => {
    elements.overlay.hidden = false;
  }, 280);
}

function finishGame(won, explodedCell = null) {
  state.ended = true;
  stopTimer();
  setStatus(won ? "排雷成功" : "游戏结束", won ? "😎" : "😵");
  if (!won) showAllMines(explodedCell);
  showResult(won);
}

function reveal(cell) {
  if (state.ended || cell.isFlagged) return;
  if (cell.isRevealed) {
    chordReveal(cell);
    return;
  }
  if (!state.started) beginOn(cell);

  if (cell.isMine) {
    finishGame(false, cell);
    return;
  }

  revealSafeArea(cell);
  checkForWin();
}

function checkForWin() {
  if (!state.ended && state.revealedSafe === state.cells.length - state.mines) {
    finishGame(true);
  }
}

function chordReveal(cell) {
  if (state.ended || !cell.isRevealed || cell.adjacent === 0) return;
  const neighbors = getNeighbors(cell);
  const flaggedCount = neighbors.filter((neighbor) => neighbor.isFlagged).length;
  if (flaggedCount !== cell.adjacent) return;

  for (const neighbor of neighbors) {
    if (neighbor.isRevealed || neighbor.isFlagged) continue;
    if (neighbor.isMine) {
      finishGame(false, neighbor);
      return;
    }
    revealSafeArea(neighbor);
  }
  checkForWin();
}

function toggleFlag(cell) {
  if (state.ended || cell.isRevealed) return;
  cell.isFlagged = !cell.isFlagged;
  state.flags += cell.isFlagged ? 1 : -1;
  cell.element.textContent = cell.isFlagged ? "⚑" : "";
  cell.element.classList.toggle("flagged", cell.isFlagged);
  cell.element.setAttribute(
    "aria-label",
    `第 ${cell.row + 1} 行，第 ${cell.col + 1} 列，${cell.isFlagged ? "已插旗" : "未翻开"}`,
  );
  updateCounters();
}

function cellFromEvent(event) {
  const button = event.target.closest(".cell");
  if (!button) return null;
  return getCell(Number(button.dataset.row), Number(button.dataset.col));
}

function clearPressPreview() {
  for (const cell of state.cells) {
    cell.element.classList.remove("pressed-preview");
  }
  if (state.started && !state.ended) setStatus("排雷中", "😐");
  else if (!state.ended) setStatus("准备开始", "🙂");
}

function showPressPreview(cell) {
  if (!state.pressPreview || state.ended || state.inputMode !== "reveal" || cell.isFlagged) return;
  clearPressPreview();
  setStatus(state.started ? "排雷中" : "准备开始", "😮");

  if (!cell.isRevealed) {
    cell.element.classList.add("pressed-preview");
    return;
  }

  if (cell.adjacent === 0) return;
  const neighbors = getNeighbors(cell);
  for (const neighbor of neighbors) {
    if (!neighbor.isRevealed && !neighbor.isFlagged) {
      neighbor.element.classList.add("pressed-preview");
    }
  }
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const config = validateSettings();
  if (config.error) {
    elements.formError.textContent = config.error;
    return;
  }
  newGame(config);
});

elements.rows.addEventListener("input", updateMineLimit);
elements.cols.addEventListener("input", updateMineLimit);
elements.pressPreview.addEventListener("change", () => {
  state.pressPreview = elements.pressPreview.checked;
  if (!state.pressPreview) clearPressPreview();
});

elements.board.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  const cell = cellFromEvent(event);
  if (!cell) return;
  state.suppressClickCell = null;
  showPressPreview(cell);
  if (state.revealTiming === "down" && state.inputMode === "reveal") {
    state.suppressClickCell = cell;
    reveal(cell);
  }
});

elements.board.addEventListener("pointerup", clearPressPreview);
elements.board.addEventListener("pointerleave", clearPressPreview);
elements.board.addEventListener("pointercancel", clearPressPreview);
window.addEventListener("pointerup", clearPressPreview);

elements.board.addEventListener("click", (event) => {
  const cell = cellFromEvent(event);
  if (!cell) return;
  if (state.inputMode === "flag") toggleFlag(cell);
  else if (state.suppressClickCell === cell) state.suppressClickCell = null;
  else reveal(cell);
});

elements.board.addEventListener("contextmenu", (event) => {
  const cell = cellFromEvent(event);
  if (!cell) return;
  event.preventDefault();
  toggleFlag(cell);
});

elements.restart.addEventListener("click", () => newGame());
elements.playAgain.addEventListener("click", () => newGame());
elements.closeResult.addEventListener("click", () => {
  elements.overlay.hidden = true;
});

for (const button of elements.modeButtons) {
  button.addEventListener("click", () => {
    state.inputMode = button.dataset.mode;
    for (const modeButton of elements.modeButtons) {
      const active = modeButton === button;
      modeButton.classList.toggle("active", active);
      modeButton.setAttribute("aria-pressed", String(active));
    }
  });
}

for (const button of elements.timingButtons) {
  button.addEventListener("click", () => {
    state.revealTiming = button.dataset.timing;
    for (const timingButton of elements.timingButtons) {
      const active = timingButton === button;
      timingButton.classList.toggle("active", active);
      timingButton.setAttribute("aria-pressed", String(active));
    }
  });
}

updateMineLimit();
newGame();
