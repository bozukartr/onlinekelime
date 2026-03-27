// Kelime listesi words.txt dosyasından yüklenecek
let WORDS = [];


const ROWS = 6;
const COLS = 5;

let secretWord = "";
let gameOver = false;
let lockedPositions = [false, false, false, false, false]; // her iki oyuncu için paylaşılan yeşil harfler
let winner = null; // "player1" veya "player2"
let currentTurn = "player1"; // Şu anda kimin sırası olduğunu tutar

// Oyun modu
let isOnlineMode = false;
let isLocalMode = false;
let myPlayerNumber = 1; // Ben hangi oyuncuyum (1 veya 2)

// Firebase değişkenleri
let database = null;
let auth = null;
let currentUser = null;
let currentRoomRef = null;
let currentRoomCode = null;
let userCoins = 0;

// Firebase yapılandırması (ücretsiz public demo)
const firebaseConfig = {
  apiKey: "AIzaSyBoJhL__0ubqzw1rniO8wgrh0nvBlP55eM",
  authDomain: "onlinekelime.firebaseapp.com",
  databaseURL: "https://onlinekelime-default-rtdb.firebaseio.com",
  projectId: "onlinekelime",
  storageBucket: "onlinekelime.firebasestorage.app",
  messagingSenderId: "286213395752",
  appId: "1:286213395752:web:be9932439887d1fb0dec1d",
  measurementId: "G-0KV0ZC3XZF"
};

// Timer variables
let timerInterval = null;
let timeLeft = 120;
const TURN_DURATION = 120;
const timerDisplay = document.getElementById("timerDisplay");


// Oyuncu 1
let currentRow1 = 0;
let firstLetterHintGiven1 = false;
const boardEl1 = document.getElementById("board1");
const guessButton1 = document.getElementById("guessButton1");
const gridInputs1 = []; // [row][col]

// Oyuncu 2
let currentRow2 = 0;
let firstLetterHintGiven2 = false;
const boardEl2 = document.getElementById("board2");
const guessButton2 = document.getElementById("guessButton2");
const gridInputs2 = []; // [row][col]

const resetButton = document.getElementById("resetButton");
const newGameButton = document.getElementById("newGameButton");

// UI Elementleri
const connectionScreen = document.getElementById("connection-screen");
const gameScreen = document.getElementById("game-screen");
const onlineOptions = document.getElementById("online-options");
const roomInfo = document.getElementById("room-info");
const joinForm = document.getElementById("join-form");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const roomCodeInput = document.getElementById("roomCodeInput");
const statusText = document.getElementById("statusText");
const opponentName = document.getElementById("opponentName");

// Tab Elements
const gameTabs = document.getElementById("game-tabs");
const tabPlayer1 = document.getElementById("tabPlayer1");
const tabPlayer2 = document.getElementById("tabPlayer2");
const player1Section = document.getElementById("player1Section");
const player2Section = document.getElementById("player2Section");
// passButton removed
const powerupsContainer = document.getElementById("powerups-container");
const revealLetterBtn = document.getElementById("revealLetterBtn");
const revealTileBtn = document.getElementById("revealTileBtn");

// Timer Elements
const timer1 = document.getElementById("timer1");
const timer2 = document.getElementById("timer2");

const fogBtn = document.getElementById("fogBtn");

// Power-up States
let isFogActive = false; // For me (buying it)
let isFogged = false;    // For me (being victim)
let fogTurnsLeft = 0;    // How many turns fog lasts



// Selection Mode State
let isSelectingTile = false;

// Sanal Klavye Düzeni (Görseldeki 4 satırlı tasarım)
const KEYBOARD_LAYOUT = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'ı', 'o', 'p', 'ğ', 'ü'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ş', 'i'],
  ['⬆️', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'ö', 'ç', '⌫'],
  ['123', '😊', 'SPACE', '↵']
];




// Toast System
function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-20px)";
    toast.style.transition = "all 0.4s ease";
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// Oyun Sonu Modal
async function showGameEndModal(isWin, word) {
  const title = isWin ? "🎉 TEBRİKLER!" : "😔 OYUN BİTTİ";
  const message = isWin ? 
    `Harika! Kelimeyi doğru buldun: <strong>${word}</strong>` : 
    `Maalesef tahmin hakkın doldu. Doğru kelime: <strong>${word}</strong>`;
  
  // Modal butonları
  const actions = [
    { text: "Yeni Oyun", primary: true, callback: () => {
        if (isOnlineMode && myPlayerNumber === 2) {
            showToast("Sadece oda sahibi yeni oyun başlatabilir.", "info");
        } else {
            // New game button'a tıklanmış gibi davran
            document.getElementById("newGameButton").click();
        }
    }},
    { text: "Kapat", callback: () => {} }
  ];

  await showCustomModal(title, message, actions);
}

// Sanal Klavye Oluştur
function createKeyboard() {
  const container = document.getElementById("virtual-keyboard");
  if (!container) return;
  container.innerHTML = '';

  KEYBOARD_LAYOUT.forEach(row => {
    const rowEl = document.createElement("div");
    rowEl.className = "keyboard-row";

    row.forEach(key => {
      const btn = document.createElement("button");
      btn.textContent = key;
      btn.className = "key";
      
      // Özel buton sınıfları
      if (key === 'SPACE') btn.classList.add("space-key");
      if (key === '↵') btn.classList.add("enter-key");
      if (['⬆️', '⌫', '123', '😊'].includes(key)) btn.classList.add("tool-key");
      
      btn.id = `key-${key.toLowerCase()}`;
      btn.onclick = () => handleKeyClick(key);
      rowEl.appendChild(btn);
    });

    container.appendChild(rowEl);
  });
}

function handleKeyClick(key) {
  if (gameOver) return;

  const currentBoard = (myPlayerNumber === 2) ? gridInputs2 : gridInputs1;
  const currRow = (myPlayerNumber === 2) ? currentRow2 : currentRow1;
  const guessBtn = (myPlayerNumber === 2) ? guessButton2 : guessButton1;

  if (!currentBoard[currRow]) return;

  if (key === '⌫') {
    // Son harfi sil
    for (let i = COLS - 1; i >= 0; i--) {
      if (currentBoard[currRow][i].value && !currentBoard[currRow][i].disabled) {
        currentBoard[currRow][i].value = '';
        currentBoard[currRow][i].focus();
        break;
      }
    }
  } else if (key === '↵') {
     guessBtn.click();
  } else if (key === '😊') {
     toggleEmojiBar();
  } else if (key === '⬆️' || key === 'UP_ARROW') {
     console.log("Powerup key clicked");
     togglePowerupMenu();
  } else if (['123', 'SPACE', '⬆️'].includes(key)) {
     return;
  } else {
    // Harf ekle
    for (let i = 0; i < COLS; i++) {
      if (!currentBoard[currRow][i].value) {
        currentBoard[currRow][i].value = key.toLocaleLowerCase('tr-TR');
        if (i < COLS - 1) currentBoard[currRow][i+1].focus();
        break;
      }
    }
  }
}

function toggleEmojiBar() {
  const bar = document.getElementById("emoji-bar");
  if (bar) {
    const isHidden = bar.style.display === "none";
    bar.style.display = isHidden ? "flex" : "none";
    
    // Açıldığında klavyenin üstüne veya altına kaymasını engellemek için küçük bir margin ayarı
    if (!isHidden) {
      bar.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }
}

function updateKeyColors(guess, result) {
    for (let i = 0; i < guess.length; i++) {
        // Türkçe karakter duyarlı lowercase (I -> ı, İ -> i)
        const char = guess[i].toLocaleLowerCase('tr-TR');
        const res = result[i];
        const keyBtn = document.getElementById(`key-${char}`);
        if (!keyBtn) continue;

        if (res === "correct") {
            keyBtn.classList.add("correct");
            keyBtn.classList.remove("present", "absent");
        } else if (res === "present") {
            // Sadece daha önce doğru (yeşil) bulunmadıysa sarı yap
            if (!keyBtn.classList.contains("correct")) {
                keyBtn.classList.add("present");
                keyBtn.classList.remove("absent");
            }
        } else if (res === "absent") {
            // Daha önce yeşil veya sarı bulunmadıysa gri yap
            if (!keyBtn.classList.contains("correct") && !keyBtn.classList.contains("present")) {
                keyBtn.classList.add("absent");
            }
        }
    }
}

const customModal = document.getElementById('customModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalActions = document.getElementById('modalActions');

function showCustomModal(title, message, actions = []) {
  return new Promise((resolve) => {
    if (!customModal) return resolve(null);

    modalTitle.textContent = title;
    modalMessage.innerHTML = message; // innerHTML for <strong>
    modalActions.innerHTML = '';

    actions.forEach(btn => {
      const buttonEl = document.createElement('button');
      buttonEl.textContent = btn.text;
      buttonEl.className = `modal-btn ${btn.primary ? 'modal-btn-confirm' : 'modal-btn-cancel'}`;
      buttonEl.onclick = () => {
        customModal.style.display = 'none';
        if (btn.callback) btn.callback();
        resolve(true);
      };
      modalActions.appendChild(buttonEl);
    });

    customModal.style.display = 'flex';
  });
}

async function showAlert(message, title = "Bilgi") {
  return showCustomModal(title, message, [
    { text: 'Tamam', primary: true }
  ]);
}

async function showConfirm(message, title = "Onay") {
  return new Promise((resolve) => {
      showCustomModal(title, message, [
        { text: 'İptal', primary: false, callback: () => resolve(false) },
        { text: 'Evet', primary: true, callback: () => resolve(true) }
      ]);
  });
}


// Kelime listesini words.txt dosyasından yükle

async function loadWords() {
  try {
    const response = await fetch('words.txt');
    const text = await response.text();
    // Satırlara böl ve boş satırları filtrele
    WORDS = text.split('\n')
      .map(word => word.trim())
      .filter(word => word.length === 5); // Sadece 5 harfli kelimeleri al

    return true;
  } catch (error) {
    console.error('Kelime listesi yüklenemedi:', error);
    await showAlert('Kelime listesi yüklenemedi. Lütfen sayfayı yenileyin.', 'Hata');
    return false;

  }
}

// Türkçe karakterleri koruyarak büyük harfe çevirme fonksiyonu
function turkishToUpper(text) {
  const turkishMap = {
    'i': 'İ',
    'ı': 'I',
    'ş': 'Ş',
    'ğ': 'Ğ',
    'ü': 'Ü',
    'ö': 'Ö',
    'ç': 'Ç',
    'İ': 'İ',
    'I': 'I',
    'Ş': 'Ş',
    'Ğ': 'Ğ',
    'Ü': 'Ü',
    'Ö': 'Ö',
    'Ç': 'Ç'
  };

  return text.split('').map(char => turkishMap[char] || char.toUpperCase()).join('');
}

function pickRandomWord() {
  if (WORDS.length === 0) {
    console.error('Kelime listesi henüz yüklenmedi!');
    return "HATA!";
  }
  const index = Math.floor(Math.random() * WORDS.length);
  return turkishToUpper(WORDS[index]);
}

// Kelimenin listede olup olmadığını kontrol et
function isValidWord(word) {
  if (WORDS.length === 0) return true; // Kelimeler yüklenmediyse her şeye izin ver

  const upperWord = turkishToUpper(word);

  // WORDS dizisinde ara
  return WORDS.some(w => turkishToUpper(w) === upperWord);
}

// Timer Functions
// Timer Functions
function updateTimerDisplay() {
  // Clear both timers first
  if (timer1) {
    timer1.textContent = "";
    timer1.classList.remove("warning");
  }
  if (timer2) {
    timer2.textContent = "";
    timer2.classList.remove("warning");
  }

  // Determine active timer
  let activeTimer = null;
  if (!isOnlineMode) {
    // Local mode: use timer1 simply (or alternate if we had 2 local players explicitly designated, but local mode logic is simpler)
    activeTimer = timer1;
  } else {
    if (currentTurn === "player1") activeTimer = timer1;
    else if (currentTurn === "player2") activeTimer = timer2;
  }

  if (activeTimer) {
    activeTimer.textContent = timeLeft + "s";
    if (timeLeft <= 10) {
      activeTimer.classList.add("warning");
    }
  }
}

function startTimer() {
  stopTimer(); // Ensure no duplicates
  if (gameOver) return;

  timeLeft = TURN_DURATION;
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();

    if (timeLeft <= 0) {
      handleTurnTimeout();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  updateTimerDisplay(); // Will clear text if not set again
  // Actually we might want to keep the last time or clear it? 
  // Let's clear it for cleaner UI
  if (timer1) timer1.textContent = "";
  if (timer2) timer2.textContent = "";
}


async function handleTurnTimeout() {
  stopTimer();

  if (gameOver) return;


  let gridInputs, currentRow;

  if (currentTurn === "player1") {
    gridInputs = gridInputs1;
    currentRow = currentRow1;
  } else {
    gridInputs = gridInputs2;
    currentRow = currentRow2;
  }

  // Show message
  showToast(currentTurn === "player1" ? "⏰ Süre doldu!" : "⏰ Rakibin süresi doldu!", "info");

  // Lock current row as failed
  if (gridInputs[currentRow]) {
    for (let c = 0; c < COLS; c++) {
      const input = gridInputs[currentRow][c];
      input.disabled = true;
      if (!input.value) {
        input.value = "-";
      }

      // Animasyonu tetikle
      input.classList.add("reveal");
      setTimeout(() => {
        input.classList.add("absent");
        // Animasyon bitince sınıfı temizle (tab geçişlerinde tekrarlamaması için)
        setTimeout(() => input.classList.remove("reveal"), 600);
      }, 250 + (c * 100));
    }
  }

  // Move to next row
  // We need to update the global variable
  if (currentTurn === "player1") {
    currentRow1++;
  } else {
    currentRow2++;
  }

  // Check Game Over by rows
  // If no rows left, game over? logic handled in next turn check usually

  // Switch Turn
  currentTurn = currentTurn === "player1" ? "player2" : "player1";

  // Send update to Firebase
  if (isOnlineMode && currentRoomRef) {
    try {
      const updates = {
        currentTurn: currentTurn
      };

      // Update the row for the player who timed out
      // Note: currentTurn is already switched.
      // So if I was player1, I timed out. Now currentTurn is player2.
      // I need to update player1's row.
      const timedOutPlayer = currentTurn === "player1" ? "player2" : "player1";

      updates[timedOutPlayer + "/currentRow"] = (timedOutPlayer === "player1" ? currentRow1 : currentRow2);

      await currentRoomRef.update(updates);

    } catch (err) {
      console.error("Timeout sync error:", err);
    }
  }

  updateBoardsForTurn();
}



function createBoard(boardEl, gridInputs, guessButton) {
  boardEl.innerHTML = "";
  gridInputs.length = 0;

  for (let r = 0; r < ROWS; r++) {
    const rowDiv = document.createElement("div");
    rowDiv.className = "row";
    const rowInputs = [];

    for (let c = 0; c < COLS; c++) {
      const input = document.createElement("input");
      input.readOnly = true;
      input.setAttribute("inputmode", "none");
      input.maxLength = 1;
      input.className = "tile";
      input.autocomplete = "off";
      input.inputMode = "text";
      input.setAttribute("autocorrect", "off");
      input.setAttribute("autocapitalize", "none");
      input.setAttribute("spellcheck", "false");

      // Yazarken bir sonraki UYGUN (kilitli olmayan) kutuya geç
      input.addEventListener("input", (e) => {
        // Türkçe karakterleri koruyarak büyük harfe çevir
        e.target.value = turkishToUpper(e.target.value);

        if (e.target.value) {
          let nextIndex = c + 1;
          while (nextIndex < COLS && rowInputs[nextIndex].disabled) {
            nextIndex++;
          }
          if (nextIndex < COLS) {
            rowInputs[nextIndex].focus({ preventScroll: true });
          }
        }
      });

      // Backspace ile önceki uygun kutuya dön + Enter ile tahmin
      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !e.target.value) {
          let prevIndex = c - 1;
          while (prevIndex >= 0 && rowInputs[prevIndex].disabled) {
            prevIndex--;
          }
          if (prevIndex >= 0) {
            rowInputs[prevIndex].focus({ preventScroll: true });
          }
        } else if (e.key === "Enter") {
          e.preventDefault();
          guessButton.click();
        }
      });

      // Tile Selection Click Handler
      input.addEventListener("click", () => {
        if (isSelectingTile) {
          handleTileSelection(r, c);
        }
      });

      rowDiv.appendChild(input);

      rowInputs.push(input);
    }

    boardEl.appendChild(rowDiv);
    gridInputs.push(rowInputs);
  }
}

function setActiveRow(gridInputs, rowIndex, currentRowRef, firstLetterHintGivenRef, isCurrentPlayer) {
  // Tüm kutuları kapat
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      gridInputs[r][c].disabled = true;
    }
  }

  if (rowIndex < 0 || rowIndex >= ROWS) return currentRowRef;

  // Aktif satırı aç, yeşilleri sabitle, gerekirse 6. tahminde ilk harfi ipucu ver
  for (let c = 0; c < COLS; c++) {
    const input = gridInputs[rowIndex][c];
    input.classList.remove("correct", "present", "absent", "locked", "hint");

    // 6. tahmin (rowIndex === 5) ve ilk harf hala bulunmadıysa ipucu
    if (
      rowIndex === ROWS - 1 && // 6. satır
      c === 0 && // ilk harf
      !lockedPositions[0] && // daha önce yeşil bulunmamış
      !firstLetterHintGivenRef // ipucu daha önce verilmemiş
    ) {
      // >>> EK KONTROL: Diğer tüm harfler (1–4) zaten yeşil mi?
      const otherAllLocked = lockedPositions.slice(1).every(Boolean);

      if (!otherAllLocked) {
        // Diğer harfler tamamen çözülmemişse ipucu ver
        input.value = secretWord[0];
        input.disabled = true;
        input.classList.add("locked", "hint"); // kırmızı ipucu
        firstLetterHintGivenRef = true;
        continue;
      }
    }

    // Daha önce doğru bulunan (yeşil) harfler (HER İKİ OYUNCUDA DA!)
    if (lockedPositions[c]) {
      input.value = secretWord[c];
      input.disabled = true;
      input.classList.add("correct", "locked");
    } else {
      input.value = "";
      // Sadece sırası gelen oyuncunun kutuları açılır
      input.disabled = !isCurrentPlayer;
    }
  }

  // İlk yazılabilir kutuya odaklan (sadece sırası gelen oyuncu için)
  if (isCurrentPlayer) {
    let focused = false;
    for (let c = 0; c < COLS; c++) {
      const input = gridInputs[rowIndex][c];
      if (!input.disabled) {
        input.focus({ preventScroll: true });
        focused = true;
        break;
      }
    }

    // Eğer bu satırda yazılabilir kutu yoksa (tamamen kilitliyse), bir sonraki satıra geç
    if (!focused && rowIndex + 1 < ROWS) {
      currentRowRef++;
      return setActiveRow(gridInputs, currentRowRef, currentRowRef, firstLetterHintGivenRef, isCurrentPlayer);
    }
  }

  return currentRowRef;
}

function getGuessFromRow(gridInputs, rowIndex) {
  let guess = "";
  for (let c = 0; c < COLS; c++) {
    const ch = turkishToUpper(gridInputs[rowIndex][c].value.trim());
    guess += ch || " ";
  }
  return guess;
}

function evaluateGuess(guess) {

  const result = new Array(COLS).fill("absent");
  const targetArr = secretWord.split("");
  const guessArr = guess.split("");

  const remainingCounts = {};
  // Önce doğru yerdekiler
  for (let i = 0; i < COLS; i++) {
    if (guessArr[i] === targetArr[i]) {
      result[i] = "correct";
    } else {
      const ch = targetArr[i];
      remainingCounts[ch] = (remainingCounts[ch] || 0) + 1;
    }
  }

  // Sonra yanlış yerde olanlar (sarı)
  for (let i = 0; i < COLS; i++) {
    if (result[i] === "correct") continue;
    const ch = guessArr[i];
    if (ch !== " " && remainingCounts[ch] > 0) {
      result[i] = "present";
      remainingCounts[ch]--;
    } else {
      result[i] = "absent";
    }
  }

  return result;
}

function colourRow(gridInputs, rowIndex, result) {
  for (let c = 0; c < COLS; c++) {
    const input = gridInputs[rowIndex][c];
    const isHint = input.classList.contains("hint");

    // Animasyonu tetikle
    input.classList.add("reveal");

    // Renk değişimini tam dönüş sırasında (250ms + gecikme) yap
    const delay = 250 + (c * 100);

    setTimeout(() => {
      if (!isHint) {
        input.classList.remove("correct", "present", "absent");
        if (result[c] === "correct") {
          input.classList.add("correct");
        } else if (result[c] === "present") {
          input.classList.add("present");
        } else {
          input.classList.add("absent");
        }
      }
      // Animasyon bitince sınıfı temizle
      setTimeout(() => input.classList.remove("reveal"), 600);
    }, delay);

    input.disabled = true;
  }
}

function lockGreenPositions(result) {
  let hasNewLocks = false;
  for (let i = 0; i < COLS; i++) {
    if (result[i] === "correct" && !lockedPositions[i]) {
      lockedPositions[i] = true;
      hasNewLocks = true;
    }
  }
  return hasNewLocks;
}

// Yeni yeşil harfler bulunduğunda diğer oyuncunun aktif satırını güncelle
function updateOtherPlayerBoard(gridInputs, currentRow, isCurrentPlayer) {
  if (currentRow < 0 || currentRow >= ROWS) return;
  if (!gridInputs[currentRow]) return;

  for (let c = 0; c < COLS; c++) {
    const input = gridInputs[currentRow][c];
    if (!input) continue;

    if (lockedPositions[c] && !input.classList.contains("hint")) {
      input.value = secretWord[c];
      input.disabled = true;
      input.classList.add("correct", "locked");
      input.classList.remove("present", "absent");
    } else if (!lockedPositions[c] && !input.classList.contains("hint")) {
      // Sıra olmayan oyuncunun kutularını kapat, ama değerleri koru
      input.disabled = !isCurrentPlayer;
    }
  }
}

// Sıra değiştiğinde tüm tahtaları güncelle
function updateBoardsForTurn() {
  // Tahtalar hazır değilse işlem yapma
  if (gridInputs1.length === 0 || gridInputs2.length === 0) {
    return;
  }

  const isPlayer1Turn = currentTurn === "player1";
  const isPlayer2Turn = currentTurn === "player2";

  // Timer'ı başlat
  startTimer();

  // Oyuncu 1'in tahtasını güncelle
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (gridInputs1[r] && gridInputs1[r][c]) {
        const input = gridInputs1[r][c];
        // Sadece aktif satırdaki, kilitli olmayan kutular açılır
        if (r === currentRow1 && !lockedPositions[c] && !input.classList.contains("hint")) {
          input.disabled = !isPlayer1Turn;
        } else if (r === currentRow1 && lockedPositions[c]) {
          input.disabled = true;
        }
      }
    }
  }

  // Oyuncu 2'nin tahtasını güncelle
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (gridInputs2[r] && gridInputs2[r][c]) {
        const input = gridInputs2[r][c];
        // Sadece aktif satırdaki, kilitli olmayan kutular açılır
        if (r === currentRow2 && !lockedPositions[c] && !input.classList.contains("hint")) {
          input.disabled = !isPlayer2Turn;
        } else if (r === currentRow2 && lockedPositions[c]) {
          input.disabled = true;
        }
      }
    }
  }

  // Butonları güncelle
  if (guessButton1) guessButton1.disabled = !isPlayer1Turn || gameOver;
  if (guessButton2) guessButton2.disabled = !isPlayer2Turn || gameOver;

  // Oyuncu bölümlerine görsel efekt ekle
  const player1Section = boardEl1 ? boardEl1.parentElement : null;
  const player2Section = boardEl2 ? boardEl2.parentElement : null;

  if (player1Section && player2Section) {
    if (isPlayer1Turn) {
      player1Section.classList.add("active");
      player2Section.classList.remove("active");
    } else {
      player2Section.classList.add("active");
      player1Section.classList.remove("active");
    }
  }

  // Sıra mesajlarını göster
  if (!gameOver) {
    if (isPlayer1Turn && currentRow1 < ROWS) {
      if (myPlayerNumber === 1) showToast("Sıra sende! ⏰", "info");
    } else if (isPlayer2Turn && currentRow2 < ROWS) {
      if (myPlayerNumber === 2) showToast("Sıra sende! ⏰", "info");
    }

    // Sıra olan oyuncunun aktif kutusuna odaklan
    if (isPlayer1Turn && currentRow1 < ROWS && gridInputs1[currentRow1]) {
      for (let c = 0; c < COLS; c++) {
        const input = gridInputs1[currentRow1][c];
        if (input && !input.disabled) {
          input.focus({ preventScroll: true });
          break;
        }
      }
    } else if (isPlayer2Turn && currentRow2 < ROWS && gridInputs2[currentRow2]) {
      for (let c = 0; c < COLS; c++) {
        const input = gridInputs2[currentRow2][c];
        if (input && !input.disabled) {
          input.focus({ preventScroll: true });
          break;
        }
      }
    }
  }
}

async function handleGuess(playerName, gridInputs, currentRow, messageEl, guessButton, otherGridInputs, otherCurrentRow) {
  if (gameOver) return;

  stopTimer(); // Stop timer when making a move

  // Online modda sıra kontrolü
  if (isOnlineMode) {
    const myTurn = (playerName === "player1" && myPlayerNumber === 1) ||
      (playerName === "player2" && myPlayerNumber === 2);
    if (!myTurn || currentTurn !== playerName) {
      messageEl.textContent = "Senin sıran değil!";
      messageEl.className = "message neutral";
      return;
    }
  }
  // Lokal modda sıra kontrolü yok (tek oyuncu)

  const guess = getGuessFromRow(gridInputs, currentRow);

  if (guess.indexOf(" ") !== -1) {
    showToast("Lütfen tüm harfleri doldur.", "error");
    return;
  }

  if (guess.length !== COLS) {
    showToast("Kelime 5 harf olmalı.", "error");
    return;
  }

  // Kelime listesinde var mı kontrol et
  if (!isValidWord(guess)) {
    showToast("Bu kelime listede yok!", "error");
    return;
  }

  const result = evaluateGuess(guess);
  colourRow(gridInputs, currentRow, result);
  updateKeyColors(guess, result); // Klavyeyi boya
  const hasNewLocks = lockGreenPositions(result);


  if (guess === secretWord) {
    winner = playerName;
    gameOver = true;
    guessButton1.disabled = true;
    guessButton2.disabled = true;

    // Yeni Oyun butonunu göster
    showNewGameButton();

    const isMyWin = (playerName === "player1" && (isLocalMode || myPlayerNumber === 1)) ||
                    (playerName === "player2" && myPlayerNumber === 2);
    
    showGameEndModal(isMyWin, secretWord);

    // Diğer oyuncuya kaybettiğini göster
    if (isOnlineMode) {
        // Rakip zaten kendi SW listener'ı ile alacak
    }

    if (isMyWin && currentUser) {
      await addCoins(50); // Kazanma ödülü: 50 altın

      // İstatistikleri güncelle
      await updateUserStats(true);
    }


    // Online modda rakibe bildir
    if (isOnlineMode) {
      sendWin(playerName);
      sendGuess(playerName, guess, result, currentRow + 1);
    }

    return;
  }

  currentRow++;
  if (currentRow >= ROWS) {
    guessButton.disabled = true;

    // Lokal modda veya tek oyuncuysa anlamı göster
    if (isLocalMode) {
      showNewGameButton();
      showGameEndModal(false, secretWord);
    }

    // İki oyuncu da tahminlerini tükettiyse oyun biter
    if ((playerName === "player1" && currentRow2 >= ROWS) ||
      (playerName === "player2" && currentRow1 >= ROWS)) {
      gameOver = true;
      showNewGameButton();
      showToast("Oyun bitti! Kelime: " + secretWord, "info");
    } else {
      // Sıra diğer oyuncuya geçer
      currentTurn = playerName === "player1" ? "player2" : "player1";
    }

    // Aktif satırı güncelle
    if (playerName === "player1") {
      currentRow1 = currentRow;
    } else {
      currentRow2 = currentRow;
    }

    // Online modda rakibe bildir
    if (isOnlineMode) {
      sendGuess(playerName, guess, result, currentRow);
    }

    updateBoardsForTurn();
    return;
  }

  // Aktif satırı güncelle
  if (playerName === "player1") {
    currentRow1 = setActiveRow(gridInputs, currentRow, currentRow, firstLetterHintGiven1, true);
  } else {
    currentRow2 = setActiveRow(gridInputs, currentRow, currentRow, firstLetterHintGiven2, true);
  }

  // Sıra diğer oyuncuya geçer
  currentTurn = playerName === "player1" ? "player2" : "player1";

  // Yeni yeşil harfler bulunduysa diğer oyuncunun tahtasını güncelle
  if (hasNewLocks) {
    const otherPlayerTurn = currentTurn;
    const isOtherPlayerTurn = currentTurn !== playerName;
    updateOtherPlayerBoard(otherGridInputs, otherCurrentRow, isOtherPlayerTurn);
  }

  // Online modda rakibe bildir
  sendGuess(playerName, guess, result, currentRow);
}

// Tüm tahtaları yeni sıra için güncelle
updateBoardsForTurn();


// Reset Game Logic (Fix Powerup Reuse & Reset States)
function resetGame(skipWordSelection = false, forceNewWord = false) {
  // Reset Power-up States
  isSelectingTile = false;
  isFogActive = false;
  isFogged = false;
  fogTurnsLeft = 0;

  // Powerup butonlarını güncelle
  updatePowerupButtons();

  // Kelime seçimi
  if (forceNewWord) {
    // ZORLA YENİ KELİME SEÇ (Yeni Oyun butonu için)
    secretWord = pickRandomWord();
    if (isLocalMode) {
      currentTurn = "player1";
    } else {
      currentTurn = Math.random() < 0.5 ? "player1" : "player2";
    }
  } else if (skipWordSelection) {
    // MEVCUT KELİMEYİ KULLAN - HİÇBİR ŞEKLE DEĞİŞTİRME!
  } else {
    // Yeni kelime seç
    if (isLocalMode) {
      secretWord = pickRandomWord();
      currentTurn = "player1";
    } else if (isOnlineMode && myPlayerNumber === 1) {
      // Oyuncu 1 için - ama sadece ilk seferde!
      // createRoom'da zaten seçilmişse tekrar seçme
      if (!secretWord || secretWord === "HATA!") {
        secretWord = pickRandomWord();
        currentTurn = Math.random() < 0.5 ? "player1" : "player2";
      }
    }
  }

  // Yeni Oyun butonunu gizle, oyun başladı
  hideNewGameButton();

  currentRow1 = 0;
  currentRow2 = 0;
  gameOver = false;
  winner = null;
  lockedPositions = [false, false, false, false, false];
  firstLetterHintGiven1 = false;
  firstLetterHintGiven2 = false;

  stopTimer(); // Stop any existing timer

  if (guessButton1) guessButton1.disabled = false;
  if (guessButton2) guessButton2.disabled = false;

  // Lokal modda sadece board1 oluştur
  if (isLocalMode) {
    createBoard(boardEl1, gridInputs1, guessButton1);
    currentRow1 = setActiveRow(gridInputs1, 0, 0, firstLetterHintGiven1, true);
  } else {
    // Online modda her iki board'u da oluştur
    createBoard(boardEl1, gridInputs1, guessButton1);
    createBoard(boardEl2, gridInputs2, guessButton2);

    // Her iki tahtayı da başlat
    const isPlayer1Turn = currentTurn === "player1";
    const isPlayer2Turn = currentTurn === "player2";

    currentRow1 = setActiveRow(gridInputs1, 0, 0, firstLetterHintGiven1, isPlayer1Turn);
    currentRow2 = setActiveRow(gridInputs2, 0, 0, firstLetterHintGiven2, isPlayer2Turn);

    // Sıra durumunu güncelle
    updateBoardsForTurn();
  }

  createKeyboard();
  initPowerupListeners();
}

// ======================
// ONLINE MULTIPLAYER LOGIC
// ======================

// Firebase'i başlat
function initFirebase() {
  if (auth) return true; // Already initialized
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    database = firebase.database();
    auth = firebase.auth();
    
    // Explicitly set persistence to LOCAL
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    // Auth durumunu dinle
    auth.onAuthStateChanged(async (user) => {
      console.log("Auth state change:", user ? "User logged in" : "No user");
      if (user) {
        currentUser = user;
        
        try {
          // Giriş yapıldıysa kullanıcı verilerini kontrol et/başlat
          await initializeUserData(user.uid, user.displayName, user.photoURL);
        } catch (e) {
          console.error("User init failed:", e);
        }
        
        showUserProfile(user);
        loadUserData(user.uid);

        // Giriş ekranını gizle, mod seçim ekranını göster
        const loginScr = document.getElementById("login-screen");
        const modeSel = document.getElementById("mode-selection");
        if (loginScr) loginScr.style.display = "none";
        if (modeSel) modeSel.style.display = "block";
      } else {
        currentUser = null;
        hideUserProfile();

        // Giriş ekranını göster
        const loginScr = document.getElementById("login-screen");
        const modeSel = document.getElementById("mode-selection");
        if (loginScr) loginScr.style.display = "block";
        if (modeSel) modeSel.style.display = "none";
      }
    });

    // Redirect sonucunu yakala
    auth.getRedirectResult().then((result) => {
      if (result && result.user) {
          console.log("Redirect login successful:", result.user.displayName);
      }
    }).catch((error) => {
      console.error("Redirect logic error:", error);
      if (error.code === 'auth/network-request-failed') {
          showToast("Ağ hatası! Lütfen internetinizi kontrol edin.", "error");
      } else {
          showToast("Giriş sırasında hata oluştu: " + error.message, "error");
      }
    });

    return true;
  } catch (error) {
    console.error('Firebase başlatılamadı:', error);
    return false;
  }
}

// Google ile giriş yap
async function loginWithGoogle() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    // Reverting to Popup as primary, with Redirect as fallback
    try {
        console.log("Attempting popup login...");
        const result = await auth.signInWithPopup(provider);
        console.log("Popup login success:", result.user.displayName);
    } catch (popupError) {
        console.warn("Popup blocked or failed, falling back to redirect:", popupError.code);
        if (popupError.code === 'auth/popup-blocked' || 
            popupError.code === 'auth/cancelled-popup-request' ||
            popupError.code === 'auth/network-request-failed') {
            auth.signInWithRedirect(provider);
        } else {
            alert("Giriş hatası: " + popupError.message);
        }
    }

    // onAuthStateChanged otomatik olarak ekranları değiştirecek

  } catch (error) {
    console.error('Google giriş hatası:', error);
    if (error.code === 'auth/popup-closed-by-user') {
    } else {
      alert('Giriş yapılamadı: ' + error.message);
    }
  }
}

// Kullanıcı verisini başlat
async function initializeUserData(uid, displayName, photoURL) {
  try {
    const userRef = database.ref('users/' + uid);
    const snapshot = await userRef.once('value');

    if (!snapshot.exists()) {
      // Yeni kullanıcı, başlangıç verisi oluştur
      await userRef.set({
        displayName: displayName,
        photoURL: photoURL,
        coins: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        createdAt: Date.now()
      });
    } else {
      // Mevcut kullanıcı, profil bilgilerini güncelle
      await userRef.update({
        displayName: displayName,
        photoURL: photoURL,
        lastLogin: Date.now()
      });
    }
  } catch (error) {
    console.error('Kullanıcı verisi başlatma hatası:', error);
  }
}

// Kullanıcı verisini yükle
async function loadUserData(uid) {
  try {
    const userRef = database.ref('users/' + uid);
    const snapshot = await userRef.once('value');
    const userData = snapshot.val();

    if (userData) {
      userCoins = userData.coins || 0;
      updateCoinsDisplay();
    }
  } catch (error) {
    console.error('Kullanıcı verisi yükleme hatası:', error);
  }
}

// Altın ekle/çıkar
async function addCoins(amount) {
  if (!currentUser) {
    return;
  }

  try {
    const userRef = database.ref('users/' + currentUser.uid);
    userCoins += amount;

    // Negatif olmasın
    if (userCoins < 0) userCoins = 0;

    await userRef.update({
      coins: userCoins
    });

    updateCoinsDisplay();

    // Altın animasyonu
    showCoinAnimation(amount);
  } catch (error) {
    console.error('Altın işlemi hatası:', error);
  }
}

// Altın animasyonu göster
function showCoinAnimation(amount) {
  const coinsEl = document.getElementById("userCoins");
  if (!coinsEl) return;

  if (amount > 0) {
    // Kazanma - yeşil
    coinsEl.style.transform = "scale(1.3)";
    coinsEl.style.color = "#4caf50";
  } else {
    // Harcama - kırmızı
    coinsEl.style.transform = "scale(0.9)";
    coinsEl.style.color = "#ff5252";
  }

  setTimeout(() => {
    coinsEl.style.transform = "scale(1)";
    coinsEl.style.color = "#ffb74d";
  }, 300);
}

// Altın göstergesini güncelle
function updateCoinsDisplay() {
  const coinsEl = document.getElementById("userCoins");
  if (coinsEl) {
    coinsEl.textContent = "💰 " + userCoins;
  }

  // Power-up butonlarını güncelle
  updatePowerupButtons();
}

// Power-up butonlarını güncelle (yeterli altın var mı?)
function updatePowerupButtons() {
  const rBtn = document.getElementById("revealLetterBtn");
  const tBtn = document.getElementById("revealTileBtn");
  const fBtn = document.getElementById("fogBtn");

  const canAffordLetter = userCoins >= 10 && !gameOver;
  const canAffordTile = userCoins >= 20 && !gameOver;
  const canAffordFog = userCoins >= 30 && !gameOver && isOnlineMode;

  if (rBtn) rBtn.disabled = !canAffordLetter || !currentUser;
  if (tBtn) tBtn.disabled = !canAffordTile || !currentUser;
  if (fBtn) fBtn.disabled = !canAffordFog || !currentUser;
}


// Kullanıcı profilini göster
function showUserProfile(user) {
  const profileEl = document.getElementById("user-profile");
  const avatarEl = document.getElementById("userAvatar");
  const nameEl = document.getElementById("userName");

  if (profileEl) profileEl.style.display = "block";
  if (avatarEl) avatarEl.src = user.photoURL || "https://via.placeholder.com/48";
  if (nameEl) nameEl.textContent = user.displayName || "Oyuncu";

  updateCoinsDisplay();
}

// Kullanıcı profilini gizle
function hideUserProfile() {
  const profileEl = document.getElementById("user-profile");
  if (profileEl) profileEl.style.display = "none";
}

// Çıkış yap
async function logout() {
  if (!confirm("Çıkış yapmak istediğinize emin misiniz?")) {
    return;
  }

  try {
    await auth.signOut();

    // onAuthStateChanged otomatik olarak ekranları değiştirecek
    // Oyun ekranındaysa ana menüye dön
    if (gameScreen.style.display !== "none") {
      gameScreen.style.display = "none";
      connectionScreen.style.display = "block";
    }

  } catch (error) {
    console.error('Çıkış hatası:', error);
    alert('Çıkış yapılamadı: ' + error.message);
  }
}

// Sayfa yüklendiğinde kelimeleri yükle
// Sayfa yüklendiğinde kelimeleri yükle
async function initGame() {
  const loaded = await loadWords();
  initFirebase();

  // Session Restore Logic
  const savedRoom = localStorage.getItem('wordle_room');
  const savedPlayer = localStorage.getItem('wordle_player');
  const savedUid = localStorage.getItem('wordle_uid');

  // Only auto-rejoin if we have specific room data and user is logged in (or was guest)
  if (savedRoom && savedPlayer && loaded) {

    // If we need auth, wait a bit for firebase auth to resolve? 
    // Actually initFirebase sets up the listener. We might need to wait for onAuthStateChanged.
    // But let's try a simple approach first: 
    // If user was guest, no auth needed. If user was logged in, the auth listener will trigger updateScreens.
    // We should wait until we know if we are logged in.

    // A simple timeout or check state
    // Use an interval to wait for auth to settle, but no more than 3 seconds
    let attempts = 0;
    const authCheckInterval = setInterval(() => {
      attempts++;
      if (currentUser || attempts > 6) { // 6 * 500ms = 3s
        clearInterval(authCheckInterval);
        if (currentUser && currentUser.uid === savedUid) {
          connectToRoom(savedRoom, parseInt(savedPlayer));
        } else if (!savedUid && !currentUser) {
          connectToRoom(savedRoom, parseInt(savedPlayer));
        }
      }
    }, 500);
  }
}


// Auth-related Listeners
const googleLoginBtnEl = document.getElementById("googleLoginBtn");
if (googleLoginBtnEl) {
    googleLoginBtnEl.addEventListener("click", () => loginWithGoogle());
}

const skipLoginBtnEl = document.getElementById("skipLoginBtn");
if (skipLoginBtnEl) {
    skipLoginBtnEl.addEventListener("click", () => {
        const loginScreen = document.getElementById("login-screen");
        const modeSelection = document.getElementById("mode-selection");
        if (loginScreen) loginScreen.style.display = "none";
        if (modeSelection) modeSelection.style.display = "block";
    });
}

const logoutBtnEl = document.getElementById("logoutBtn");
if (logoutBtnEl) {
    logoutBtnEl.addEventListener("click", () => logout());
}

// Lokal mod başlat
document.getElementById("localModeBtn").addEventListener("click", async () => {
  if (WORDS.length === 0) {
    alert('Kelimeler yükleniyor, lütfen bekleyin...');
    await loadWords();
  }

  isLocalMode = true;
  isOnlineMode = false;
  myPlayerNumber = 0; // Lokal modda tek oyuncu
  connectionScreen.style.display = "none";
  gameScreen.style.display = "block";
  document.getElementById("connection-status").style.display = "none";

  // Lokal modda sadece tek board göster
  document.getElementById("player1Section").style.display = "flex";
  document.getElementById("player2Section").style.display = "none";
  document.getElementById("player1Title").textContent = "Türkçe Wordl";

  document.getElementById("disconnectBtn").style.display = "none";
  document.getElementById("backToMenuBtn").style.display = "inline-block";

  // Pas Geç butonunu gizle (lokal modda yok)
  // passButton removed


  // Power-ups'ı göster (sadece giriş yaptıysa)
  if (currentUser && powerupsContainer) {
    powerupsContainer.style.display = "block";
  }

  // Lokal modda sadece ilk tabı başlık olarak kullan
  if (gameTabs) {
    gameTabs.style.display = "flex";
    tabPlayer1.style.pointerEvents = "none"; // Tıklanamaz olsun
    tabPlayer2.style.display = "none";
    tabPlayer1.classList.add("active");
  }

  resetGame();
});

// Online mod seç
document.getElementById("onlineModeBtn").addEventListener("click", () => {
  document.getElementById("mode-selection").style.display = "none";
  onlineOptions.style.display = "block";
  // Butonları göster ve diğer formları gizle
  document.querySelector(".online-buttons").style.display = "flex";
  roomInfo.style.display = "none";
  joinForm.style.display = "none";
});

// Geri dön
document.getElementById("backBtn").addEventListener("click", () => {
  onlineOptions.style.display = "none";
  roomInfo.style.display = "none";
  joinForm.style.display = "none";

  // Ekranları kullanıcı durumuna göre ayarla
  updateScreensBasedOnAuth();

  // Butonları tekrar göster
  document.querySelector(".online-buttons").style.display = "flex";
});

// Oda oluştur
document.getElementById("createRoomBtn").addEventListener("click", async () => {
  if (WORDS.length === 0) {
    alert('Kelimeler yükleniyor, lütfen bekleyin...');
    await loadWords();
  }
  createRoom();
});

// Odaya katıl
document.getElementById("joinRoomBtn").addEventListener("click", () => {
  document.querySelector(".online-buttons").style.display = "none";
  joinForm.style.display = "block";
});

// Bağlan
// Bağlan
document.getElementById("connectBtn").addEventListener("click", async () => {
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  if (roomCode) {
    if (roomCode.length < 4) {
      await showAlert("Oda kodu çok kısa.");
      return;
    }

    joinRoom(roomCode);
  } else {
    await showAlert("Lütfen oda kodunu girin.");
  }
});



// Kodu kopyala
document.getElementById("copyCodeBtn").addEventListener("click", () => {
  roomCodeDisplay.select();
  document.execCommand("copy");
  const btn = document.getElementById("copyCodeBtn");
  btn.textContent = "✅ Kopyalandı!";
  setTimeout(() => {
    btn.textContent = "📋 Kopyala";
  }, 2000);
});

// Ana menüye dön
document.getElementById("backToMenuBtn").addEventListener("click", async () => {
  if (isOnlineMode) {
    if (await showConfirm("Online oyundan ayrılmak istediğinize emin misiniz?")) {
      disconnect();
    }
  } else {

    // Lokal modda direkt ana menüye dön
    gameScreen.style.display = "none";
    connectionScreen.style.display = "block";
    onlineOptions.style.display = "none";

    // Ekranları kullanıcı durumuna göre ayarla
    updateScreensBasedOnAuth();

    isLocalMode = false;
    isOnlineMode = false;
    myPlayerNumber = 0;

    // Reset tabs
    if (gameTabs) {
      gameTabs.style.display = "none";
      tabPlayer1.style.pointerEvents = "auto";
      tabPlayer2.style.display = "flex";
    }

    // Oyun durumunu sıfırla
    gameOver = false;
    currentRow1 = 0;
    currentRow2 = 0;
    lockedPositions = [false, false, false, false, false];
  }
});

// Bağlantıyı kes
document.getElementById("disconnectBtn").addEventListener("click", () => {
  disconnect();
});

// Rastgele oda kodu oluştur
function generateRoomCode() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

// Oda oluştur (Firebase)
async function createRoom() {
  if (!database) {
    alert("Bağlantı kurulamadı. Lütfen sayfayı yenileyin.");
    return;
  }

  isOnlineMode = true;
  myPlayerNumber = 1;

  // Rastgele oda kodu
  currentRoomCode = generateRoomCode();
  currentRoomRef = database.ref('rooms/' + currentRoomCode);

  // Kelime seç
  secretWord = pickRandomWord();
  currentTurn = Math.random() < 0.5 ? "player1" : "player2";

  try {
    // Oda verilerini oluştur
    await currentRoomRef.set({
      host: "player1",
      secretWord: secretWord,
      currentTurn: currentTurn,
      player1: {
        connected: true,
        currentRow: 0,
        displayName: currentUser ? currentUser.displayName : "Oyuncu 1",
        photoURL: currentUser ? currentUser.photoURL : null,
        uid: currentUser ? currentUser.uid : null
      },
      player2: {
        connected: false,
        currentRow: 0,
        displayName: null,
        photoURL: null,
        uid: null
      },
      lockedPositions: [false, false, false, false, false],
      gameOver: false,
      winner: null,
      createdAt: Date.now()
    });


    // Oda kodunu göster
    roomCodeDisplay.value = currentRoomCode;
    document.querySelector(".online-buttons").style.display = "none";
    roomInfo.style.display = "block";


    // Oyun verilerini dinlemeye başla (Player1 için)
    listenToGameUpdates();

    // Player2'nin katılmasını bekle
    let hasPlayer2Joined = false;
    currentRoomRef.child('player2/connected').on('value', (snapshot) => {
      if (snapshot.val() === true && !hasPlayer2Joined) {
        hasPlayer2Joined = true;

        // Oyunu başlat
        startOnlineGame();
      }
    });

  } catch (error) {
    console.error("Oda oluşturma hatası:", error);
    alert("Oda oluşturulamadı: " + error.message);
  }
}

// Odaya katıl (Firebase)
async function joinRoom(roomCode) {
  if (!database) {
    alert("Bağlantı kurulamadı. Lütfen sayfayı yenileyin.");
    return;
  }

  isOnlineMode = true;
  myPlayerNumber = 2;
  currentRoomCode = roomCode;
  currentRoomRef = database.ref('rooms/' + roomCode);

  try {
    // Oda var mı kontrol et
    const snapshot = await currentRoomRef.once('value');

    if (!snapshot.exists()) {
      alert("Oda bulunamadı. Kod doğru mu kontrol edin.");
      document.querySelector(".online-buttons").style.display = "block";
      joinForm.style.display = "none";
      return;
    }

    const roomData = snapshot.val();

    if (roomData.player2.connected) {
      alert("Bu oda dolu. Başka bir oda kodu deneyin.");
      document.querySelector(".online-buttons").style.display = "block";
      joinForm.style.display = "none";
      return;
    }

    // Oyuna katıl
    await currentRoomRef.child('player2').update({
      connected: true,
      currentRow: 0,
      displayName: currentUser ? currentUser.displayName : "Oyuncu 2",
      photoURL: currentUser ? currentUser.photoURL : null,
      uid: currentUser ? currentUser.uid : null
    });

    // Oyun verilerini al ve SAKLA - BU ÇOK ÖNEMLİ!
    secretWord = roomData.secretWord;
    currentTurn = roomData.currentTurn;
    lockedPositions = roomData.lockedPositions || [false, false, false, false, false];
    currentRow1 = roomData.player1?.currentRow || 0;
    currentRow2 = roomData.player2?.currentRow || 0;


    // ÖNCE oyun verilerini dinlemeye başla
    listenToGameUpdates();

    // SONRA oyunu başlat (board'ları oluştur)
    // startOnlineGame içinde resetGame(true) çağrılacak ve secretWord DEĞİŞMEYECEK
    await startOnlineGame();

  } catch (error) {
    console.error("Odaya katılma hatası:", error);
    alert("Odaya katılılamadı: " + error.message);
    document.querySelector(".online-buttons").style.display = "block";
    joinForm.style.display = "none";
  }
}

// Re-connect helper (used by auto-rejoin)
async function connectToRoom(roomCode, playerNumber) {
  if (!database) return;

  isOnlineMode = true;
  myPlayerNumber = playerNumber;
  currentRoomCode = roomCode;
  currentRoomRef = database.ref('rooms/' + roomCode);

  try {
    const snapshot = await currentRoomRef.once('value');
    const roomData = snapshot.val();

    if (!roomData) {
      localStorage.removeItem('wordle_room');
      return;
    }

    secretWord = roomData.secretWord;
    currentTurn = roomData.currentTurn;

    // Re-attach listeners
    listenToGameUpdates();
    startOnlineGame();

  } catch (e) {
    console.error("Re-connect failed", e);
  }
}

// Oyun güncellemelerini dinle (Firebase)
function listenToGameUpdates() {

  if (!currentRoomRef) return;

  // Tahminleri dinle
  const otherPlayer = myPlayerNumber === 1 ? "player2" : "player1";

  let lastProcessedTimestamp = 0;
  currentRoomRef.child(otherPlayer + '/lastGuess').on('value', (snapshot) => {
    const guessData = snapshot.val();
    if (guessData && guessData.timestamp && guessData.timestamp > lastProcessedTimestamp) {
      // Yeni tahmin geldi
      lastProcessedTimestamp = guessData.timestamp;
      applyOpponentGuess(guessData);
    }
  });


  // Reset dinle (oyuncu 2 için)
  if (myPlayerNumber === 2) {
    let lastResetTime = Date.now();
    currentRoomRef.child('gameOver').on('value', (snapshot) => {
      const isGameOver = snapshot.val();

      // Oyun bitmişti ama şimdi false oldu = reset yapıldı
      if (isGameOver === false && gameOver === true) {
        const now = Date.now();
        // Son 2 saniyede reset yapıldıysa
        if (now - lastResetTime > 2000) {
          lastResetTime = now;

          // Firebase'den güncel verileri al
          currentRoomRef.once('value').then((snap) => {
            const roomData = snap.val();
            if (roomData) {
              secretWord = roomData.secretWord;
              currentTurn = roomData.currentTurn;
              lockedPositions = roomData.lockedPositions || [false, false, false, false, false];
              currentRow1 = roomData.player1?.currentRow || 0;
              currentRow2 = roomData.player2?.currentRow || 0;

              resetGame(true);
            }
          });
        }
      } else if (isGameOver === true) {
        lastResetTime = Date.now();
      }
    });
  }

  // Kilitli pozisyonları dinle
  currentRoomRef.child('lockedPositions').on('value', (snapshot) => {
    const positions = snapshot.val();
    if (positions && gridInputs1.length > 0 && gridInputs2.length > 0) {
      const oldLocked = [...lockedPositions];
      lockedPositions = positions;

      // Yeni kilitli harfler varsa her iki tahtayı da güncelle
      for (let i = 0; i < COLS; i++) {
        if (lockedPositions[i] && !oldLocked[i]) {
          // Yeni yeşil harf bulundu, tahtaları güncelle
          if (gridInputs1[currentRow1] && gridInputs1[currentRow1][i]) {
            gridInputs1[currentRow1][i].value = secretWord[i];
            gridInputs1[currentRow1][i].classList.add("correct", "locked");
            gridInputs1[currentRow1][i].classList.remove("present", "absent");
            gridInputs1[currentRow1][i].disabled = true;
          }
          if (gridInputs2[currentRow2] && gridInputs2[currentRow2][i]) {
            gridInputs2[currentRow2][i].value = secretWord[i];
            gridInputs2[currentRow2][i].classList.add("correct", "locked");
            gridInputs2[currentRow2][i].classList.remove("present", "absent");
            gridInputs2[currentRow2][i].disabled = true;
          }
        }
      }

      updateBoardsForTurn();
    }
  });

  // Sıra değişimini dinle
  currentRoomRef.child('currentTurn').on('value', (snapshot) => {
    const turn = snapshot.val();
    if (turn && gridInputs1.length > 0 && gridInputs2.length > 0) {
      const oldTurn = currentTurn;
      currentTurn = turn;

      // Sıra değiştiyse zamanlayıcıyı yeniden başlat
      if (oldTurn !== currentTurn) {
      }

      updateBoardsForTurn();
    }
  });

  // Oyun bitişini dinle
  currentRoomRef.child('winner').on('value', (snapshot) => {
    const winner = snapshot.val();
    if (winner && !gameOver) {
      handleOnlineGameEnd(winner);
    }
  });

  // Bağlantı durumunu dinle
  let hasSeenOpponentConnected = false;
  currentRoomRef.child(otherPlayer + '/connected').on('value', async (snapshot) => {
    const isConnected = snapshot.val();

    // Rakip hiç bağlanmadıysa (ilk yüklemede false) uyarı gösterme
    if (!hasSeenOpponentConnected) {
      if (isConnected === true) {
        hasSeenOpponentConnected = true;
        statusText.textContent = "🟢 Bağlı";

        // Rakip bilgilerini al ve göster
        await updateOpponentInfo();
      }
      // İlk yüklemede false ise sadece logla, uyarı gösterme
      return;
    }

    // Rakip daha önce bağlandıysa ve şimdi ayrıldıysa uyar
    if (isConnected === false && isOnlineMode && hasSeenOpponentConnected) {
      statusText.textContent = "🔴 Bağlantı Kesildi";
      opponentName.textContent = "Rakip: Ayrıldı";
      await showAlert("Rakip oyundan ayrıldı.");
    } else if (isConnected === true) {
      hasSeenOpponentConnected = true;
      statusText.textContent = "🟢 Bağlı";

      // Rakip bilgilerini al ve göster
      await updateOpponentInfo();
    }
  });

  // Listen for Emojis
  currentRoomRef.child(otherPlayer + '/latestEmoji').on('value', (snapshot) => {
    const emojiData = snapshot.val(); // { emoji: "👋", timestamp: 12345 }
    if (emojiData && emojiData.timestamp > (Date.now() - 5000)) {
      // Only show if recent (5s)
      showFloatingEmoji(emojiData.emoji, otherPlayer);
    }
  });

  // Listen for Fog on ME
  const myKey = 'player' + myPlayerNumber;
  currentRoomRef.child(myKey + '/isFogged').on('value', async (snapshot) => {
    const amIFogged = snapshot.val();
    if (amIFogged === true && !isFogged) {
      isFogged = true;
      fogTurnsLeft = 2;
      await showAlert("🌫️ Rakip sis bastı! Sonraki 2 tahminde renk ve klavye göremeyeceksin.");
    } else if (amIFogged === false) {
      isFogged = false;
      fogTurnsLeft = 0;
    }
  });

}


// Rakip bilgilerini güncelle
async function updateOpponentInfo() {
  if (!currentRoomRef) return;

  try {
    const snapshot = await currentRoomRef.once('value');
    const roomData = snapshot.val();

    if (!roomData) return;

    const opponentData = myPlayerNumber === 1 ? roomData.player2 : roomData.player1;
    const myData = myPlayerNumber === 1 ? roomData.player1 : roomData.player2;

    // Rakip bilgilerini göster
    if (opponentData) {
      const opponentName = opponentData.displayName || "Rakip";
      const opponentPhoto = opponentData.photoURL;

      // Status bar'da rakip ismi
      document.getElementById("opponentName").textContent = "Rakip: " + opponentName;

      // Board üstünde rakip bilgileri
      const opponentAvatarEl = myPlayerNumber === 1 ?
        document.getElementById("player2Avatar") :
        document.getElementById("player1Avatar");
      const opponentTitleEl = myPlayerNumber === 1 ?
        document.getElementById("player2Title") :
        document.getElementById("player1Title");
      const opponentSubtitleEl = myPlayerNumber === 1 ?
        document.getElementById("player2Subtitle") :
        document.getElementById("player1Subtitle");

      if (opponentAvatarEl && opponentPhoto) {
        opponentAvatarEl.src = opponentPhoto;
        opponentAvatarEl.style.display = "block";
      }
      if (opponentTitleEl) {
        opponentTitleEl.textContent = opponentName;
      }
      if (opponentSubtitleEl) {
        // Alt yazıda da ismi göster (daha küçük)
        opponentSubtitleEl.textContent = opponentData.uid ? "🟢 Çevrimiçi" : "👤 Misafir";
        opponentSubtitleEl.style.color = "#aaa";
      }
    }

    // Kendi bilgilerimi göster
    if (myData) {
      const myAvatarEl = myPlayerNumber === 1 ?
        document.getElementById("player1Avatar") :
        document.getElementById("player2Avatar");
      const myTitleEl = myPlayerNumber === 1 ?
        document.getElementById("player1Title") :
        document.getElementById("player2Title");
      const mySubtitleEl = myPlayerNumber === 1 ?
        document.getElementById("player1Subtitle") :
        document.getElementById("player2Subtitle");

      const myName = myData.displayName || "Sen";

      if (myAvatarEl && myData.photoURL) {
        myAvatarEl.src = myData.photoURL;
        myAvatarEl.style.display = "block";
      }
      if (myTitleEl) {
        myTitleEl.textContent = myName;
      }
      if (mySubtitleEl) {
        mySubtitleEl.textContent = "Sen";
        mySubtitleEl.style.color = "#4caf50";
        mySubtitleEl.style.fontWeight = "600";
      }
    }

  } catch (error) {
    console.error('Rakip bilgisi alma hatası:', error);
  }
}

// Online oyunu başlat
async function startOnlineGame() {
  connectionScreen.style.display = "none";
  gameScreen.style.display = "block";
  document.getElementById("connection-status").style.display = "flex";

  // Online modda sekme sistemini göster
  if (gameTabs) {
    gameTabs.style.display = "flex";
    // Varsayılan olarak Player 1 (Kendi) tabını aktif et
    switchTab("player1");
  }

  document.getElementById("player1Title").textContent = myPlayerNumber === 1 ? "Sen" : "Rakip";
  document.getElementById("player2Title").textContent = myPlayerNumber === 2 ? "Sen" : "Rakip";
  document.getElementById("disconnectBtn").style.display = "inline-block";
  document.getElementById("backToMenuBtn").style.display = "inline-block";

  // Power-ups'ı göster (sadece giriş yaptıysa)
  if (currentUser && powerupsContainer) {
    powerupsContainer.style.display = "block";
  }

  // Her iki oyuncu da board'u oluşturmalı
  if (myPlayerNumber === 1) {
    // Oyun sahibi board'u oluşturur (kelime zaten createRoom'da seçildi)

    // ÖNEMLİ: Kelime zaten var, YENİ SEÇME!
    resetGame(true); // skipWordSelection = true

    // Oyuncu bilgilerini göster
    await updateOpponentInfo();
  } else {
    // Katılan oyuncu Firebase'den güncel verileri bir kez daha okuyor

    try {
      const snapshot = await currentRoomRef.once('value');
      const roomData = snapshot.val();
      if (roomData) {
        secretWord = roomData.secretWord;
        currentTurn = roomData.currentTurn;
        lockedPositions = roomData.lockedPositions || [false, false, false, false, false];

      }
    } catch (error) {
      console.error("Veri okuma hatası:", error);
    }


    // Board'u oluştur (kelime zaten Firebase'den alındı)
    resetGame(true); // skipWordSelection = true


    // Oyuncu bilgilerini göster
    await updateOpponentInfo();
  }
}

// Firebase'e tahmin gönder
async function sendGuess(playerName, guess, result, newCurrentRow) {
  if (!currentRoomRef) return;

  try {
    const updates = {};
    updates[playerName + '/lastGuess'] = {
      guess: guess,
      result: result,
      currentRow: newCurrentRow,
      timestamp: Date.now()
    };
    updates[playerName + '/currentRow'] = newCurrentRow;
    updates['lockedPositions'] = lockedPositions;
    updates['currentTurn'] = currentTurn;

    await currentRoomRef.update(updates);
  } catch (error) {
    console.error("Tahmin gönderme hatası:", error);
  }
}

// Firebase'e kazanma durumu gönder
async function sendWin(playerName) {
  if (!currentRoomRef) return;

  try {
    await currentRoomRef.update({
      winner: playerName,
      gameOver: true
    });
  } catch (error) {
    console.error("Kazanma durumu gönderme hatası:", error);
  }
}

// Rakibin tahminini uygula
function applyOpponentGuess(guessData) {
  const otherPlayer = myPlayerNumber === 1 ? "player2" : "player1";
  const otherGridInputs = myPlayerNumber === 1 ? gridInputs2 : gridInputs1;
  const rowIndex = guessData.currentRow - 1;

  if (rowIndex >= 0 && rowIndex < ROWS && otherGridInputs[rowIndex]) {
    // Rakibin sisli olup olmadığını kontrol et
    // Eğer rakip sisliyse biz de onun tahtasını sisli görürüz (symmetrical fog)
    const otherPlayerKey = myPlayerNumber === 1 ? 'player2' : 'player1';
    
    currentRoomRef.child(otherPlayerKey + '/isFogged').once('value', (snapshot) => {
        const otherIsFogged = snapshot.val();
        
        // Attacker sees everything clearly, only the victim sees fog
        // So we pass 'false' for forceFog here
        applyGuessToBoard(otherGridInputs, rowIndex, guessData.guess, guessData.result, false);
        
        if (myPlayerNumber === 1) {
          currentRow2 = guessData.currentRow;
        } else {
          currentRow1 = guessData.currentRow;
        }

        // Even if opponent is fogged, we can still update our keyboard with their colors
        updateKeyColors(guessData.guess, guessData.result);
    });

  }
}

// Pas Geç buton fonksiyonları kaldırıldı

// Yeni Oyun butonunu göster
function showNewGameButton() {
  if (newGameButton) {
    newGameButton.style.display = "inline-block";
  }
  if (resetButton) {
    resetButton.style.display = "none";
  }
}


// Yeni Oyun butonunu gizle
function hideNewGameButton() {
  if (newGameButton) {
    newGameButton.style.display = "none";
  }
  if (resetButton) {
    resetButton.style.display = "none";
  }
}

// Online oyun bitişi
async function handleOnlineGameEnd(winnerPlayer) {
  gameOver = true;
  if (guessButton1) guessButton1.disabled = true;
  if (guessButton2) guessButton2.disabled = true;

  // Yeni Oyun butonunu göster
  showNewGameButton();

  const isMyWin = (winnerPlayer === "player1" && myPlayerNumber === 1) || (winnerPlayer === "player2" && myPlayerNumber === 2);

  showGameEndModal(isMyWin, secretWord);

  if (isMyWin) {
    if (currentUser) {
      await addCoins(50);
      await updateUserStats(true);
    }
  } else {
    if (currentUser) {
      await updateUserStats(false);
    }
  }
}

// Rakibin tahminini tahtaya uygula
function applyGuessToBoard(gridInputs, rowIndex, guess, result, forceFog = false) {
  if (!gridInputs[rowIndex]) return;

  // Sis kontrolü (Yerel durum veya zorunlu durum)
  const activeFog = forceFog || (isFogged && fogTurnsLeft > 0);

  for (let c = 0; c < COLS; c++) {
    const input = gridInputs[rowIndex][c];
    if (!input) continue;

    input.value = guess[c] || '';
    input.classList.remove("correct", "present", "absent", "locked", "hint", "fogged");

    // Fog Check - scramble positions and hide real colors
    if (activeFog) {
      input.classList.add("fogged");
      // Rastgele harf göster (Kafa karıştırmak için)
      const alphabet = "abcçdefgğhıijklmnoöprsştuüvyz";
      input.value = alphabet[Math.floor(Math.random() * alphabet.length)];
      // Don't add real color classes - opponent sees nothing
    } else {
      if (result[c] === "correct") {
        input.classList.add("correct");
      } else if (result[c] === "present") {
        input.classList.add("present");
      } else {
        input.classList.add("absent");
      }
    }

    input.disabled = true;
  }

  // Sadece yerel oyuncu sis altındaysa sayaçları ve klavyeyi yönet
  if (!forceFog && isFogged && fogTurnsLeft > 0) {
    // Klavyeye 'fogged' sınıfı ekle (CSS ile renkleri saklayacağız)
    document.getElementById("virtual-keyboard").classList.add("keyboard-fogged");
    
    fogTurnsLeft--;
    if (fogTurnsLeft <= 0) {
      isFogged = false;
      fogTurnsLeft = 0;
      const myKey = 'player' + myPlayerNumber;
      if (currentRoomRef) currentRoomRef.child(myKey + '/isFogged').set(false);
      document.getElementById("virtual-keyboard").classList.remove("keyboard-fogged");
      showToast("✨ Sis kalktı! Artık renkleri görebilirsin.", "info");
    } else {
      showToast(`🌫️ Sis devam ediyor! (${fogTurnsLeft} tur kaldı)`, "warning");
    }
  } else if (!activeFog) {
    // Normal durumda klavyeyi güncelle
    updateKeyColors(guess, result);
  }
}


// Bağlantıyı kes (Firebase)
async function disconnect() {
  // Firebase bağlantısını temizle
  if (currentRoomRef && myPlayerNumber) {
    try {
      const playerKey = myPlayerNumber === 1 ? 'player1' : 'player2';
      await currentRoomRef.child(playerKey + '/connected').set(false);
      currentRoomRef.off(); // Tüm dinleyicileri kapat

      // Clear session
      localStorage.removeItem('wordle_room');
      localStorage.removeItem('wordle_player');
      localStorage.removeItem('wordle_uid');
    } catch (error) {

      console.error("Bağlantı kesme hatası:", error);
    }
  }

  currentRoomRef = null;
  currentRoomCode = null;

  // Bağlantı ekranına dön
  gameScreen.style.display = "none";
  connectionScreen.style.display = "block";
  onlineOptions.style.display = "none";
  roomInfo.style.display = "none";
  joinForm.style.display = "none";
  document.querySelector(".online-buttons").style.display = "flex";

  // Ekranları kullanıcı durumuna göre ayarla
  updateScreensBasedOnAuth();

  isOnlineMode = false;
  myPlayerNumber = 0;

  // Oyun durumunu sıfırla
  gameOver = false;
  currentRow1 = 0;
  currentRow2 = 0;
  lockedPositions = [false, false, false, false, false];
}

// Giriş durumuna göre ekranları güncelle
function updateScreensBasedOnAuth() {
  if (currentUser) {
    // Giriş yapmış
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("mode-selection").style.display = "block";
  } else {
    // Misafir veya çıkış yapmış
    document.getElementById("login-screen").style.display = "block";
    document.getElementById("mode-selection").style.display = "none";
  }
}

// ======================
// OYUN LOGİĞİ (Güncellenmiş)
// ======================

guessButton1.addEventListener("click", () => {
  if (isLocalMode) {
    // Lokal modda tek oyuncu
    handleGuess("player1", gridInputs1, currentRow1, null, guessButton1, gridInputs2, currentRow2);
  } else if (isOnlineMode && myPlayerNumber === 1) {
    // Online modda sadece kendi oyuncum
    handleGuess("player1", gridInputs1, currentRow1, null, guessButton1, gridInputs2, currentRow2);
  }
});

guessButton2.addEventListener("click", () => {
  // Lokal modda buton2 kullanılmıyor
  if (isOnlineMode && myPlayerNumber === 2) {
    handleGuess("player2", gridInputs2, currentRow2, null, guessButton2, gridInputs1, currentRow1);
  }
});

// Kullanıcı istatistiklerini güncelle
async function updateUserStats(won) {
  if (!currentUser) return;

  try {
    const userRef = database.ref('users/' + currentUser.uid);
    const snapshot = await userRef.once('value');
    const userData = snapshot.val();

    await userRef.update({
      gamesPlayed: (userData.gamesPlayed || 0) + 1,
      gamesWon: won ? (userData.gamesWon || 0) + 1 : (userData.gamesWon || 0)
    });

  } catch (error) {
    console.error('İstatistik güncelleme hatası:', error);
  }
}

// Power-up event listeners
function initPowerupListeners() {
    const rBtn = document.getElementById("revealLetterBtn");
    const tBtn = document.getElementById("revealTileBtn");
    const fBtn = document.getElementById("fogBtn");

    if (rBtn) rBtn.onclick = () => { useRevealLetter(); togglePowerupMenu(); };
    if (tBtn) tBtn.onclick = () => { useRevealTile(); togglePowerupMenu(); };
    if (fBtn) fBtn.onclick = () => { useFogBomb(); togglePowerupMenu(); };
}

async function useRevealLetter() {
  if (!currentUser) { showToast("Giriş yapmalısın!", "error"); return; }
  if (gameOver) return;
  if (userCoins < 10) { showToast("Yetersiz altın!", "error"); return; }

  const myGridInputs = (myPlayerNumber === 2) ? gridInputs2 : gridInputs1;
  const myCurrentRow = (myPlayerNumber === 2) ? currentRow2 : currentRow1;

  if (myCurrentRow >= ROWS) return;

  const unlockedIndices = [];
  for (let i = 0; i < COLS; i++) {
    if (!lockedPositions[i]) unlockedIndices.push(i);
  }

  if (unlockedIndices.length === 0) { showToast("Zaten tüm harfler açık!", "info"); return; }

  const randomIndex = unlockedIndices[Math.floor(Math.random() * unlockedIndices.length)];
  const revealedLetter = secretWord[randomIndex];

  if (myGridInputs[myCurrentRow] && myGridInputs[myCurrentRow][randomIndex]) {
    myGridInputs[myCurrentRow][randomIndex].value = revealedLetter;
    myGridInputs[myCurrentRow][randomIndex].classList.add("correct", "locked");
    myGridInputs[myCurrentRow][randomIndex].disabled = true;
    lockedPositions[randomIndex] = true;

    if (isOnlineMode && currentRoomRef) {
      await currentRoomRef.update({ lockedPositions: lockedPositions });
    }
    await addCoins(-10);
    showToast(`💡 ${randomIndex+1}. harf açıldı: ${revealedLetter}`, "info");
  }
}

async function useRevealTile() {
    if (!currentUser) { showToast("Giriş yapmalısın!", "error"); return; }
    if (gameOver) return;
    if (userCoins < 20) { showToast("Yetersiz altın!", "error"); return; }

    const isMyTurn = isLocalMode || (isOnlineMode && currentTurn === ("player" + myPlayerNumber));
    if (!isMyTurn) { showToast("Sıra sende değil!", "error"); return; }

    isSelectingTile = !isSelectingTile;
    if (isSelectingTile) {
        showToast("🎯 Harfini görmek istediğin kutucuğa tıkla!", "info");
    }
}

async function handleTileSelection(row, col) {
    isSelectingTile = false;

    const gridInputs = (myPlayerNumber === 2) ? gridInputs2 : gridInputs1;
    const currRow = (myPlayerNumber === 2) ? currentRow2 : currentRow1;
    const targetWord = isLocalMode ? secretWord : mySecretWord;

    if (!targetWord) { showToast("Kelime henüz belirlenmedi!", "error"); return; }
    if (row !== currRow) { showToast("Sadece aktif satırdaki kutuları seçebilirsin!", "error"); return; }

    const letter = targetWord[col];
    if (!letter) return;

    if (await showConfirm(`${col+1}. kutucuğun harfini görmek için 20 💰 harcamak ister misin?`)) {
        await addCoins(-20);
        gridInputs[row][col].value = letter;
        gridInputs[row][col].disabled = true;
        gridInputs[row][col].classList.add("correct", "locked", "hint");
        
        // Mark as locked so 10-coin reveal won't pick it again
        lockedPositions[col] = true;
        if (isOnlineMode && currentRoomRef) {
          await currentRoomRef.update({ lockedPositions: lockedPositions });
        }

        showToast(`🎯 ${col+1}. harf açıldı: ${letter.toLocaleUpperCase('tr-TR')}`, "info");
    }
}

async function useFogBomb() {
    if (!currentUser || gameOver || !isOnlineMode) return;
    if (userCoins < 30) { showToast("Yetersiz altın!", "error"); return; }

    if (!currentRoomRef) return;

    if (await showConfirm("Sis Bombası: Rakip 2 tur boyunca renkleri ve klavyeyi göremez! (30 💰)")) {
        await addCoins(-30);
        const targetPlayer = myPlayerNumber === 1 ? "player2" : "player1";
        await currentRoomRef.child(targetPlayer + '/isFogged').set(true);
        showToast("🌫️ Sis bombası atıldı! Rakip 2 tur boyunca kör!", "info");
    }
}

function togglePowerupMenu() {
    const menu = document.getElementById("powerup-menu");
    if (!menu) {
        console.error("Powerup menu element not found!");
        return;
    }
    const isHidden = menu.style.display === "none" || menu.style.display === "";
    console.log("Toggling menu. Is hidden before:", isHidden);
    
    menu.style.display = isHidden ? "flex" : "none";
    
    if (menu.style.display === "flex") {
        updatePowerupButtons();
        // Close other bars
        const emojiBar = document.getElementById("emoji-bar");
        if (emojiBar) emojiBar.style.display = "none";
    }
}

// Global click listener to close menu when clicking outside
document.addEventListener("mousedown", (e) => {
    const menu = document.getElementById("powerup-menu");
    // Get all potential shift keys (by icon or index)
    if (menu && menu.style.display === "flex") {
        const isClickInsideMenu = menu.contains(e.target);
        const isClickOnShift = e.target.textContent === '⬆️' || e.target.closest(".key.tool-key");
        
        if (!isClickInsideMenu && !isClickOnShift) {
            menu.style.display = "none";
        }
    }
});



// Pas Geç butonu kaldırıldı

// ======================
// TAB SWITCHING LOGIC
// ======================
function switchTab(target) {
  if (!isOnlineMode) return;

  if (target === "player1") {
    tabPlayer1.classList.add("active");
    tabPlayer2.classList.remove("active");
    player1Section.style.display = "flex";
    player2Section.style.display = "none";
  } else {
    tabPlayer1.classList.remove("active");
    tabPlayer2.classList.add("active");
    player1Section.style.display = "none";
    player2Section.style.display = "flex";
  }
}

if (tabPlayer1) {
  tabPlayer1.addEventListener("click", () => switchTab("player1"));
}
if (tabPlayer2) {
  tabPlayer2.addEventListener("click", () => switchTab("player2"));
}


// Yeni Oyun butonu (oyun bittiğinde)
newGameButton.addEventListener("click", async () => {
  if (isOnlineMode && myPlayerNumber === 1) {
    // Oda sahibi yeni oyun başlatır

    // Yeni kelime seç
    resetGame(false, true); // forceNewWord = true


    // Firebase'e yeni oyun verilerini gönder
    if (currentRoomRef) {
      try {
        await currentRoomRef.update({
          secretWord: secretWord,
          currentTurn: currentTurn,
          lockedPositions: [false, false, false, false, false],
          gameOver: false,
          winner: null,
          winner: null,
          // wordMeaning temizleme kaldirildi
          'player1/currentRow': 0,

          'player2/currentRow': 0,
          'player1/lastGuess': null,
          'player2/lastGuess': null
        });
      } catch (error) {
        console.error("Reset gönderme hatası:", error);
      }
    }
  } else if (isLocalMode) {
    // Lokal modda yeni oyun
    resetGame(false, true); // forceNewWord = true
  } else if (isOnlineMode && myPlayerNumber === 2) {
    await showAlert("Sadece oda sahibi yeni oyun başlatabilir.");
  }
});


// Sayfa yüklendiğinde oyunu başlat
// Sayfa yüklendiğinde oyunu başlat
initFirebase(); // Initialize Firebase immediately


// ======================
// EMOJI CHAT LOGIC
// ======================
async function sendEmoji(emojiChar) {
  if (!isOnlineMode || !currentRoomRef) {
    // Local mode: just show it locally for fun
    showFloatingEmoji(emojiChar, "player1");
    return;
  }

  const playerKey = myPlayerNumber === 1 ? 'player1' : 'player2';
  try {
    await currentRoomRef.child(playerKey + '/latestEmoji').set({
      emoji: emojiChar,
      timestamp: Date.now()
    });
    // Show on my screen too
    showFloatingEmoji(emojiChar, playerKey);
  } catch (e) {
    console.error("Emoji error:", e);
  }
}

function showFloatingEmoji(emoji, playerKey) {
  // Determine target element (avatar)
  let targetId = "";
  if (isLocalMode) {
    targetId = "player1Avatar"; // Local mode always player 1
  } else {
    // If I am player 1:
    if (myPlayerNumber === 1) {
      targetId = (playerKey === "player1") ? "player1Avatar" : "player2Avatar";
    } else {
      // I am player 2
      targetId = (playerKey === "player2") ? "player2Avatar" : "player1Avatar";
    }
  }

  const targetEl = document.getElementById(targetId);
  const container = targetEl ? targetEl.parentElement : document.body;

  const span = document.createElement("span");
  span.textContent = emoji;
  span.className = "floating-emoji";

  // Position it relative to the avatar/header
  if (targetEl && targetEl.parentElement) {
    targetEl.parentElement.style.position = "relative"; // Ensure header is relative
    span.style.left = "50%";
    span.style.top = "50%";
  }

  container.appendChild(span);

  // Remove after animation
  setTimeout(() => {
    span.remove();
  }, 2000);
}

initPowerupListeners();
initGame();



// PWA Service Worker Registration with Auto-Update
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=48')
      .then(reg => {
        console.log('SW Registered!', reg);
        
        // New update found
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New worker is ready, force reload after skipWaiting triggers skip
              window.location.reload();
            }
          };
        };
      })
      .catch(err => console.log('SW Failed: ', err));
  });

  // Force actual reload when the service worker changes
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
