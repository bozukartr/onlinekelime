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
const messageEl1 = document.getElementById("message1");
const gridInputs1 = []; // [row][col]

// Oyuncu 2
let currentRow2 = 0;
let firstLetterHintGiven2 = false;
const boardEl2 = document.getElementById("board2");
const guessButton2 = document.getElementById("guessButton2");
const messageEl2 = document.getElementById("message2");
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
// Pass button removed
const powerupsContainer = document.getElementById("powerups-container");

const revealLetterBtn = document.getElementById("revealLetterBtn");
const revealWordBtn = document.getElementById("revealWordBtn");

// Kelime listesini words.txt dosyasından yükle
async function loadWords() {
  try {
    const response = await fetch('words.txt');
    const text = await response.text();
    // Satırlara böl ve boş satırları filtrele
    WORDS = text.split('\n')
      .map(word => word.trim())
      .filter(word => word.length === 5); // Sadece 5 harfli kelimeleri al

    console.log(`${WORDS.length} kelime yüklendi.`);
    return true;
  } catch (error) {
    console.error('Kelime listesi yüklenemedi:', error);
    alert('Kelime listesi yüklenemedi. Lütfen sayfayı yenileyin.');
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
function updateTimerDisplay() {
  if (timerDisplay) {
    timerDisplay.textContent = "⏳ " + timeLeft;
    if (timeLeft <= 10) {
      timerDisplay.classList.add("timer-warning");
    } else {
      timerDisplay.classList.remove("timer-warning");
    }
  }
}

function startTimer() {
  stopTimer(); // Ensure no duplicates

  if (gameOver) return;

  // Timer should run if it's my turn
  // In specific modes
  const isMyTurn = (isLocalMode) ||
    (isOnlineMode && (
      (currentTurn === "player1" && myPlayerNumber === 1) ||
      (currentTurn === "player2" && myPlayerNumber === 2)
    ));

  if (!isMyTurn) {
    // Hide timer if not my turn (or show simple waiting?)
    // Let's just hide it or show "Bekleniyor..."
    if (timerDisplay) timerDisplay.style.display = "none";
    return;
  }

  timeLeft = TURN_DURATION;
  updateTimerDisplay();
  if (timerDisplay) timerDisplay.style.display = "flex";

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
  if (timerDisplay) {
    timerDisplay.style.display = "none";
    timerDisplay.classList.remove("timer-warning");
  }
}

async function handleTurnTimeout() {
  stopTimer();

  if (gameOver) return;

  console.log("Süre doldu! Sıra geçiyor...");

  let gridInputs, currentRow, messageEl;

  if (currentTurn === "player1") {
    gridInputs = gridInputs1;
    currentRow = currentRow1;
    messageEl = messageEl1;
  } else {
    gridInputs = gridInputs2;
    currentRow = currentRow2;
    messageEl = messageEl2;
  }

  // Show message
  if (messageEl) {
    messageEl.textContent = "⏰ Süre doldu!";
    messageEl.className = "message neutral";
  }

  // Lock current row as failed
  if (gridInputs[currentRow]) {
    for (let c = 0; c < COLS; c++) {
      gridInputs[currentRow][c].disabled = true;
      if (!gridInputs[currentRow][c].value) {
        gridInputs[currentRow][c].value = "-";
      }
      gridInputs[currentRow][c].classList.add("absent");
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
      input.type = "text";
      input.maxLength = 1;
      input.className = "tile";
      input.autocomplete = "off";
      input.inputMode = "text";

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
            rowInputs[nextIndex].focus();
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
            rowInputs[prevIndex].focus();
          }
        } else if (e.key === "Enter") {
          e.preventDefault();
          guessButton.click();
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
        input.focus();
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
  console.log("Tahmin değerlendiriliyor - Guess:", guess, "Target:", secretWord);

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

  console.log("Sonuç:", result);
  return result;
}

function colourRow(gridInputs, rowIndex, result) {
  for (let c = 0; c < COLS; c++) {
    const input = gridInputs[rowIndex][c];

    // İpucu (hint) kutusunu bozma, rengini değiştirme
    const isHint = input.classList.contains("hint");

    input.classList.remove("correct", "present", "absent");
    // locked/hint sınıflarını özellikle silmiyoruz

    if (!isHint) {
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
      if (messageEl1) {
        messageEl1.textContent = "Senin sıran! ⏰";
        messageEl1.className = "message neutral";
      }
      if (currentRow2 < ROWS && messageEl2) {
        messageEl2.textContent = "Rakip oynuyor...";
        messageEl2.className = "message neutral";
      }
    } else if (isPlayer2Turn && currentRow2 < ROWS) {
      if (messageEl2) {
        messageEl2.textContent = "Senin sıran! ⏰";
        messageEl2.className = "message neutral";
      }
      if (currentRow1 < ROWS && messageEl1) {
        messageEl1.textContent = "Rakip oynuyor...";
        messageEl1.className = "message neutral";
      }
    }

    // Sıra olan oyuncunun aktif kutusuna odaklan
    if (isPlayer1Turn && currentRow1 < ROWS && gridInputs1[currentRow1]) {
      for (let c = 0; c < COLS; c++) {
        const input = gridInputs1[currentRow1][c];
        if (input && !input.disabled) {
          input.focus();
          break;
        }
      }
    } else if (isPlayer2Turn && currentRow2 < ROWS && gridInputs2[currentRow2]) {
      for (let c = 0; c < COLS; c++) {
        const input = gridInputs2[currentRow2][c];
        if (input && !input.disabled) {
          input.focus();
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
    messageEl.textContent = "Lütfen tüm 5 harfi doldur.";
    messageEl.className = "message";
    return;
  }

  if (guess.length !== COLS) {
    messageEl.textContent = "Kelime 5 harf olmalı.";
    messageEl.className = "message";
    return;
  }

  // Kelime listesinde var mı kontrol et
  if (!isValidWord(guess)) {
    messageEl.textContent = "Bu kelime listede yok!";
    messageEl.className = "message";
    return;
  }

  const result = evaluateGuess(guess);
  colourRow(gridInputs, currentRow, result);
  const hasNewLocks = lockGreenPositions(result);

  if (guess === secretWord) {
    winner = playerName;
    messageEl.textContent = "🎉 KAZANDIN! Kelime: " + secretWord;
    messageEl.className = "message win";
    gameOver = true;
    guessButton1.disabled = true;
    guessButton2.disabled = true;

    // Yeni Oyun butonunu göster
    showNewGameButton();

    // Diğer oyuncuya kaybettiğini göster
    const otherMessageEl = playerName === "player1" ? messageEl2 : messageEl1;
    if (otherMessageEl) {
      otherMessageEl.textContent = "😔 Kaybettin! Kelime: " + secretWord;
      otherMessageEl.className = "message lose";
    }

    // Altın kazan (sadece ben kazandıysam)
    const isMyWin = (playerName === "player1" && (isLocalMode || myPlayerNumber === 1)) ||
      (playerName === "player2" && myPlayerNumber === 2);

    console.log("Kazanma kontrolü - playerName:", playerName, "myPlayerNumber:", myPlayerNumber, "isMyWin:", isMyWin);

    if (isMyWin && currentUser) {
      console.log("Altın kazanıldı: +10");
      await addCoins(10); // Kazanma ödülü: 10 altın

      // İstatistikleri güncelle
      await updateUserStats(true);
    }

    // Kelimenin anlamını göster (Kaldirildi)

    // Online modda rakibe bildir
    if (isOnlineMode) {
      sendWin(playerName);
      sendGuess(playerName, guess, result, currentRow + 1);
    }

    return;
  }

  currentRow++;
  if (currentRow >= ROWS) {
    messageEl.textContent = "Tahmin hakkın bitti. Kelime: " + secretWord;
    messageEl.className = "message neutral";
    guessButton.disabled = true;

    // Lokal modda veya tek oyuncuysa anlamı göster
    if (isLocalMode) {
      showWordMeaning(secretWord, messageEl);
      showNewGameButton();
    }

    // İki oyuncu da tahminlerini tükettiyse oyun biter
    if ((playerName === "player1" && currentRow2 >= ROWS) ||
      (playerName === "player2" && currentRow1 >= ROWS)) {
      gameOver = true;
      showNewGameButton();

      if (messageEl1) {
        messageEl1.textContent = "Berabere! Kelime: " + secretWord;
        messageEl1.className = "message neutral";
      }
      if (messageEl2) {
        messageEl2.textContent = "Berabere! Kelime: " + secretWord;
        messageEl2.className = "message neutral";
      }

      // Anlamı göster (Kaldirildi)
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

  messageEl.textContent = "";
  messageEl.className = "message";

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

function resetGame(skipWordSelection = false, forceNewWord = false) {
  console.log("resetGame çağrıldı - skipWordSelection:", skipWordSelection, "forceNewWord:", forceNewWord, "Mevcut kelime:", secretWord);

  // Kelime seçimi
  if (forceNewWord) {
    // ZORLA YENİ KELİME SEÇ (Yeni Oyun butonu için)
    secretWord = pickRandomWord();
    if (isLocalMode) {
      currentTurn = "player1";
    } else {
      currentTurn = Math.random() < 0.5 ? "player1" : "player2";
    }
    console.log(">>> ZORLA YENİ KELİME SEÇİLDİ:", secretWord);
  } else if (skipWordSelection) {
    // MEVCUT KELİMEYİ KULLAN - HİÇBİR ŞEKLE DEĞİŞTİRME!
    console.log(">>> MEVCUT KELIME KORUNUYOR:", secretWord);
  } else {
    // Yeni kelime seç
    if (isLocalMode) {
      secretWord = pickRandomWord();
      currentTurn = "player1";
      console.log(">>> YENİ KELIME SEÇİLDİ (Lokal):", secretWord);
    } else if (isOnlineMode && myPlayerNumber === 1) {
      // Oyuncu 1 için - ama sadece ilk seferde!
      // createRoom'da zaten seçilmişse tekrar seçme
      if (!secretWord || secretWord === "HATA!") {
        secretWord = pickRandomWord();
        currentTurn = Math.random() < 0.5 ? "player1" : "player2";
        console.log(">>> YENİ KELIME SEÇİLDİ (Online-P1):", secretWord);
      } else {
        console.log(">>> MEVCUT KELIME KULLANILIYOR (Online-P1):", secretWord);
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

  if (messageEl1) {
    messageEl1.textContent = "";
    messageEl1.className = "message";
  }
  if (messageEl2) {
    messageEl2.textContent = "";
    messageEl2.className = "message";
  }

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

  console.log("Reset tamamlandı - Kelime:", secretWord, "Sıra:", currentTurn, "Mod:", isLocalMode ? "Lokal" : "Online");
}

// ======================
// ONLINE MULTIPLAYER LOGIC
// ======================

// Firebase'i başlat
function initFirebase() {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    database = firebase.database();
    auth = firebase.auth();
    console.log('Firebase bağlantısı kuruldu.');

    // Auth durumunu dinle
    auth.onAuthStateChanged((user) => {
      if (user) {
        currentUser = user;
        console.log('Kullanıcı giriş yaptı:', user.displayName);
        showUserProfile(user);
        loadUserData(user.uid);

        // Giriş ekranını gizle, mod seçim ekranını göster
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("mode-selection").style.display = "block";
      } else {
        currentUser = null;
        console.log('Kullanıcı çıkış yaptı veya giriş yapmamış');
        hideUserProfile();

        // Giriş ekranını göster
        document.getElementById("login-screen").style.display = "block";
        document.getElementById("mode-selection").style.display = "none";
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

    const result = await auth.signInWithPopup(provider);
    const user = result.user;

    console.log('Google girişi başarılı:', user.displayName);

    // Kullanıcı veritabanını oluştur/güncelle
    await initializeUserData(user.uid, user.displayName, user.photoURL);

    // onAuthStateChanged otomatik olarak ekranları değiştirecek

  } catch (error) {
    console.error('Google giriş hatası:', error);
    if (error.code === 'auth/popup-closed-by-user') {
      console.log('Kullanıcı popup\'ı kapattı');
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
      console.log('Yeni kullanıcı oluşturuldu');
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
      console.log('Kullanıcı verisi yüklendi - Altın:', userCoins);
    }
  } catch (error) {
    console.error('Kullanıcı verisi yükleme hatası:', error);
  }
}

// Altın ekle/çıkar
async function addCoins(amount) {
  if (!currentUser) {
    console.log('Kullanıcı giriş yapmamış, altın işlemi yapılamıyor');
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
    console.log('Altın değişti:', amount, 'Toplam:', userCoins);

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
  if (!currentUser) {
    if (revealLetterBtn) revealLetterBtn.disabled = true;
    if (revealWordBtn) revealWordBtn.disabled = true;
    return;
  }

  if (revealLetterBtn) {
    revealLetterBtn.disabled = userCoins < 50 || gameOver;
  }
  if (revealWordBtn) {
    revealWordBtn.disabled = userCoins < 100 || gameOver;
  }
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
    console.log('Çıkış yapıldı');

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
async function initGame() {
  const loaded = await loadWords();
  if (loaded) {
    console.log('Oyun hazır!');
  }
  initFirebase();
}

// Google giriş butonu
document.getElementById("googleLoginBtn").addEventListener("click", () => {
  loginWithGoogle();
});

// Misafir olarak devam et
document.getElementById("skipLoginBtn").addEventListener("click", () => {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("mode-selection").style.display = "block";
  console.log('Misafir olarak devam edildi');
});

// Çıkış butonu
document.getElementById("logoutBtn").addEventListener("click", () => {
  logout();
});

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
  if (passButton) passButton.style.display = "none";

  // Power-ups'ı göster (sadece giriş yaptıysa)
  if (currentUser && powerupsContainer) {
    powerupsContainer.style.display = "block";
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
document.getElementById("connectBtn").addEventListener("click", () => {
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  if (roomCode) {
    if (roomCode.length < 4) {
      alert("Oda kodu çok kısa.");
      return;
    }
    joinRoom(roomCode);
  } else {
    alert("Lütfen oda kodunu girin.");
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
document.getElementById("backToMenuBtn").addEventListener("click", () => {
  if (isOnlineMode) {
    if (confirm("Online oyundan ayrılmak istediğinize emin misiniz?")) {
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
  return Math.random().toString(36).substring(2, 8).toUpperCase();
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

    console.log("Firebase'e kaydedilen kelime:", secretWord);

    // Oda kodunu göster
    roomCodeDisplay.value = currentRoomCode;
    document.querySelector(".online-buttons").style.display = "none";
    roomInfo.style.display = "block";

    console.log("Oda oluşturuldu:", currentRoomCode);

    // Oyun verilerini dinlemeye başla (Player1 için)
    listenToGameUpdates();

    // Player2'nin katılmasını bekle
    let hasPlayer2Joined = false;
    currentRoomRef.child('player2/connected').on('value', (snapshot) => {
      if (snapshot.val() === true && !hasPlayer2Joined) {
        hasPlayer2Joined = true;
        console.log("Oyuncu 2 katıldı!");

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

    console.log("========================================");
    console.log("Odaya katılındı:", roomCode);
    console.log("FIREBASE'DEN ALINAN KELİME:", secretWord);
    console.log("Başlangıç sırası:", currentTurn);
    console.log("========================================");

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
      console.log("Rakip tahmini uygulandı:", guessData);
    }
  });

  // Kelime anlamını dinle (online modda paylaşımlı)
  currentRoomRef.child('wordMeaning').on('value', (snapshot) => {
    const meaning = snapshot.val();
    if (meaning && gameOver) {
      // Anlam Firebase'e yazıldı, her iki oyuncuya da göster
      console.log('Anlam Firebase\'den alındı:', meaning);

      if (messageEl1 && messageEl1.textContent.includes(secretWord)) {
        const currentMsg = messageEl1.textContent.replace('Anlam yükleniyor...', '').replace(/\n\n📖 .*/s, '');
        messageEl1.textContent = currentMsg + '\n\n📖 ' + meaning;
      }
      if (messageEl2 && messageEl2.textContent.includes(secretWord)) {
        const currentMsg = messageEl2.textContent.replace('Anlam yükleniyor...', '').replace(/\n\n📖 .*/s, '');
        messageEl2.textContent = currentMsg + '\n\n📖 ' + meaning;
      }
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
              console.log("Reset algılandı, veriler güncelleniyor...");
              secretWord = roomData.secretWord;
              currentTurn = roomData.currentTurn;
              lockedPositions = roomData.lockedPositions || [false, false, false, false, false];
              currentRow1 = roomData.player1?.currentRow || 0;
              currentRow2 = roomData.player2?.currentRow || 0;

              console.log("Senkronize edilen kelime:", secretWord);
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
        console.log("Sıra değişti:", oldTurn, "→", currentTurn);
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
      alert("Rakip oyundan ayrıldı.");
    } else if (isConnected === true) {
      hasSeenOpponentConnected = true;
      statusText.textContent = "🟢 Bağlı";

      // Rakip bilgilerini al ve göster
      await updateOpponentInfo();
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

    console.log('Oyuncu bilgileri güncellendi');
  } catch (error) {
    console.error('Rakip bilgisi alma hatası:', error);
  }
}

// Online oyunu başlat
async function startOnlineGame() {
  connectionScreen.style.display = "none";
  gameScreen.style.display = "block";
  document.getElementById("connection-status").style.display = "flex";

  // Online modda her iki board'u da göster
  document.getElementById("player1Section").style.display = "flex";
  document.getElementById("player2Section").style.display = "flex";

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
    console.log("========================================");
    console.log("OYUNCU 1 - BOARD OLUŞTURULUYOR");
    console.log("Kullanılacak kelime:", secretWord);
    console.log("========================================");

    // ÖNEMLİ: Kelime zaten var, YENİ SEÇME!
    resetGame(true); // skipWordSelection = true

    // Oyuncu bilgilerini göster
    await updateOpponentInfo();
  } else {
    // Katılan oyuncu Firebase'den güncel verileri bir kez daha okuyor
    console.log("========================================");
    console.log("OYUNCU 2 - FIREBASE'DEN VERİ OKUNUYOR");

    try {
      const snapshot = await currentRoomRef.once('value');
      const roomData = snapshot.val();
      if (roomData) {
        secretWord = roomData.secretWord;
        currentTurn = roomData.currentTurn;
        lockedPositions = roomData.lockedPositions || [false, false, false, false, false];

        console.log("Firebase'den alınan kelime:", secretWord);
        console.log("Başlangıç sırası:", currentTurn);
      }
    } catch (error) {
      console.error("Veri okuma hatası:", error);
    }

    console.log("Board oluşturulmadan önce kelime:", secretWord);
    console.log("========================================");

    // Board'u oluştur (kelime zaten Firebase'den alındı)
    resetGame(true); // skipWordSelection = true

    console.log("Board oluşturulduktan SONRA kelime:", secretWord);

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
    applyGuessToBoard(otherGridInputs, rowIndex, guessData.guess, guessData.result);

    if (myPlayerNumber === 1) {
      currentRow2 = guessData.currentRow;
    } else {
      currentRow1 = guessData.currentRow;
    }

    console.log("Rakibin tahmini board'a uygulandı - Row:", rowIndex, "Guess:", guessData.guess);
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
  if (passButton) {
    passButton.style.display = "none";
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

  if ((winnerPlayer === "player1" && myPlayerNumber === 1) || (winnerPlayer === "player2" && myPlayerNumber === 2)) {
    // Ben kazandım
    const myMessageEl = myPlayerNumber === 1 ? messageEl1 : messageEl2;
    const otherMessageEl = myPlayerNumber === 1 ? messageEl2 : messageEl1;
    if (myMessageEl) {
      myMessageEl.textContent = "🎉 KAZANDIN! Kelime: " + secretWord;
      myMessageEl.className = "message win";
    }
    if (otherMessageEl) {
      otherMessageEl.textContent = "😔 Kaybettin! Kelime: " + secretWord;
      otherMessageEl.className = "message lose";
    }

    // Altın kazan (online modda ben kazandıysam)
    if (currentUser) {
      console.log("Online oyun kazanıldı - Altın ekleniyor: +10");
      await addCoins(10);
      await updateUserStats(true);
    }
  } else {
    // Rakip kazandı
    const myMessageEl = myPlayerNumber === 1 ? messageEl1 : messageEl2;
    const otherMessageEl = myPlayerNumber === 1 ? messageEl2 : messageEl1;
    if (myMessageEl) {
      myMessageEl.textContent = "😔 Kaybettin! Kelime: " + secretWord;
      myMessageEl.className = "message lose";
    }
    if (otherMessageEl) {
      otherMessageEl.textContent = "🎉 KAZANDI! Kelime: " + secretWord;
      otherMessageEl.className = "message win";
    }

    // Kaybettim, istatistik güncelle (altın yok)
    if (currentUser) {
      await updateUserStats(false);
    }
  }

  // Anlamı paylaşımlı şekilde göster (sadece bir Gemini isteği)
  // Anlamı paylaşımlı şekilde göster (Kaldirildi)
}

// Rakibin tahminini tahtaya uygula
function applyGuessToBoard(gridInputs, rowIndex, guess, result) {
  if (!gridInputs[rowIndex]) return;

  for (let c = 0; c < COLS; c++) {
    const input = gridInputs[rowIndex][c];
    if (!input) continue;

    input.value = guess[c] || '';
    input.classList.remove("correct", "present", "absent", "locked", "hint");

    if (result[c] === "correct") {
      input.classList.add("correct");
    } else if (result[c] === "present") {
      input.classList.add("present");
    } else {
      input.classList.add("absent");
    }

    input.disabled = true;
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
    handleGuess("player1", gridInputs1, currentRow1, messageEl1, guessButton1, gridInputs2, currentRow2);
  } else if (isOnlineMode && myPlayerNumber === 1) {
    // Online modda sadece kendi oyuncum
    handleGuess("player1", gridInputs1, currentRow1, messageEl1, guessButton1, gridInputs2, currentRow2);
  }
});

guessButton2.addEventListener("click", () => {
  // Lokal modda buton2 kullanılmıyor
  if (isOnlineMode && myPlayerNumber === 2) {
    handleGuess("player2", gridInputs2, currentRow2, messageEl2, guessButton2, gridInputs1, currentRow1);
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

    console.log('İstatistikler güncellendi');
  } catch (error) {
    console.error('İstatistik güncelleme hatası:', error);
  }
}

// Power-up: Harf Göster (50 altın)
revealLetterBtn.addEventListener("click", async () => {
  if (!currentUser) {
    alert("Bu özelliği kullanmak için giriş yapmalısınız!");
    return;
  }

  if (gameOver) {
    alert("Oyun bitti!");
    return;
  }

  if (userCoins < 50) {
    alert("Yeterli altınınız yok! Gereken: 50 💰");
    return;
  }

  // Lokal modda veya kendi sıramda
  const myGridInputs = isLocalMode ? gridInputs1 : (myPlayerNumber === 1 ? gridInputs1 : gridInputs2);
  const myCurrentRow = isLocalMode ? currentRow1 : (myPlayerNumber === 1 ? currentRow1 : currentRow2);

  if (myCurrentRow >= ROWS) {
    alert("Tahmin hakkınız kalmadı!");
    return;
  }

  // Henüz bulunmamış bir harfi göster
  const unlockedIndices = [];
  for (let i = 0; i < COLS; i++) {
    if (!lockedPositions[i]) {
      unlockedIndices.push(i);
    }
  }

  if (unlockedIndices.length === 0) {
    alert("Tüm harfler zaten bulunmuş!");
    return;
  }

  // Rastgele bir harf seç
  const randomIndex = unlockedIndices[Math.floor(Math.random() * unlockedIndices.length)];
  const revealedLetter = secretWord[randomIndex];

  // Harfi göster
  if (myGridInputs[myCurrentRow] && myGridInputs[myCurrentRow][randomIndex]) {
    myGridInputs[myCurrentRow][randomIndex].value = revealedLetter;
    myGridInputs[myCurrentRow][randomIndex].classList.add("correct", "locked");
    myGridInputs[myCurrentRow][randomIndex].disabled = true;

    // Pozisyonu kilitle
    lockedPositions[randomIndex] = true;

    // Online modda Firebase'e güncelle
    if (isOnlineMode && currentRoomRef) {
      await currentRoomRef.update({
        lockedPositions: lockedPositions
      });
    }
  }

  // Altın düş
  await addCoins(-50);

  alert(`💡 Harf gösterildi: ${revealedLetter} (${randomIndex + 1}. pozisyon)`);
});

// Power-up: Kelimeyi Göster (100 altın)
revealWordBtn.addEventListener("click", async () => {
  if (!currentUser) {
    alert("Bu özelliği kullanmak için giriş yapmalısınız!");
    return;
  }

  if (gameOver) {
    alert("Oyun bitti!");
    return;
  }

  if (userCoins < 100) {
    alert("Yeterli altınınız yok! Gereken: 100 💰");
    return;
  }

  if (!confirm("Kelimeyi göstermek için 100 altın harcamak istediğinize emin misiniz? Oyun otomatik kazanılacak.")) {
    return;
  }

  // Lokal modda veya kendi sıramda
  const myGridInputs = isLocalMode ? gridInputs1 : (myPlayerNumber === 1 ? gridInputs1 : gridInputs2);
  const myCurrentRow = isLocalMode ? currentRow1 : (myPlayerNumber === 1 ? currentRow1 : currentRow2);
  const myMessageEl = isLocalMode ? messageEl1 : (myPlayerNumber === 1 ? messageEl1 : messageEl2);

  if (myCurrentRow >= ROWS) {
    alert("Tahmin hakkınız kalmadı!");
    return;
  }

  // Tüm harfleri göster
  for (let i = 0; i < COLS; i++) {
    if (myGridInputs[myCurrentRow] && myGridInputs[myCurrentRow][i]) {
      myGridInputs[myCurrentRow][i].value = secretWord[i];
      myGridInputs[myCurrentRow][i].classList.add("correct");
      myGridInputs[myCurrentRow][i].disabled = true;
    }
    lockedPositions[i] = true;
  }

  // Oyunu kazan
  gameOver = true;
  if (guessButton1) guessButton1.disabled = true;
  if (guessButton2) guessButton2.disabled = true;

  if (myMessageEl) {
    myMessageEl.textContent = "🎯 Kelime güçlendirme ile gösterildi: " + secretWord;
    myMessageEl.className = "message win";
  }

  showNewGameButton();

  // Altın düş (kazanma bonusu YOK çünkü güçlendirme kullandı)
  await addCoins(-100);

  // Online modda rakibe bildir
  if (isOnlineMode && currentRoomRef) {
    const playerName = myPlayerNumber === 1 ? "player1" : "player2";
    await sendWin(playerName);
    await currentRoomRef.update({
      lockedPositions: lockedPositions
    });
  }
});

// Pas Geç butonu kaldırıldı

// Yeni Oyun butonu (oyun bittiğinde)
newGameButton.addEventListener("click", async () => {
  if (isOnlineMode && myPlayerNumber === 1) {
    // Oda sahibi yeni oyun başlatır
    console.log("========================================");
    console.log("YENİ OYUN BAŞLATILIYOR");
    console.log("Eski kelime:", secretWord);

    // Yeni kelime seç
    resetGame(false, true); // forceNewWord = true

    console.log("Yeni kelime:", secretWord);
    console.log("========================================");

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
        console.log("Firebase güncellendi - Yeni kelime:", secretWord);
      } catch (error) {
        console.error("Reset gönderme hatası:", error);
      }
    }
  } else if (isLocalMode) {
    // Lokal modda yeni oyun
    resetGame(false, true); // forceNewWord = true
  } else if (isOnlineMode && myPlayerNumber === 2) {
    alert("Sadece oda sahibi yeni oyun başlatabilir.");
  }
});

// Sayfa yüklendiğinde oyunu başlat
initGame();

