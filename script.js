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
let currentRoomRef = null;
let currentRoomCode = null;

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

function handleGuess(playerName, gridInputs, currentRow, messageEl, guessButton, otherGridInputs, otherCurrentRow) {
  if (gameOver) return;
  
  // Online modda sıra kontrolü
  if (isOnlineMode) {
    const myTurn = (playerName === "player1" && myPlayerNumber === 1) || 
                   (playerName === "player2" && myPlayerNumber === 2);
    if (!myTurn || currentTurn !== playerName) {
      messageEl.textContent = "Senin sıran değil!";
      messageEl.className = "message neutral";
      return;
    }
  } else if (currentTurn !== playerName) {
    // Lokal modda sıra kontrolü
    messageEl.textContent = "Senin sıran değil!";
    messageEl.className = "message neutral";
    return;
  }

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
    
    // Diğer oyuncuya kaybettiğini göster
    const otherMessageEl = playerName === "player1" ? messageEl2 : messageEl1;
    otherMessageEl.textContent = "😔 Kaybettin! Kelime: " + secretWord;
    otherMessageEl.className = "message lose";
    
    // Online modda rakibe bildir
    if (isOnlineMode) {
      sendWin(playerName);
      sendGuess(playerName, guess, result, currentRow + 1);
    }
    
    return;
  }

  currentRow++;
  if (currentRow >= ROWS) {
    messageEl.textContent = "Tahmin hakkın bitti.";
    messageEl.className = "message neutral";
    guessButton.disabled = true;
    
    // İki oyuncu da tahminlerini tükettiyse oyun biter
    if ((playerName === "player1" && currentRow2 >= ROWS) || 
        (playerName === "player2" && currentRow1 >= ROWS)) {
      gameOver = true;
      messageEl1.textContent = "Berabere! Kelime: " + secretWord;
      messageEl1.className = "message neutral";
      messageEl2.textContent = "Berabere! Kelime: " + secretWord;
      messageEl2.className = "message neutral";
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
  if (isOnlineMode) {
    sendGuess(playerName, guess, result, currentRow);
  }
  
  // Tüm tahtaları yeni sıra için güncelle
  updateBoardsForTurn();
}

function resetGame(skipWordSelection = false) {
  // Online modda kelime ve sıra kontrolü
  if (isOnlineMode && skipWordSelection) {
    // Oyuncu 2: Firebase'den gelen verileri kullan, YENİ KELİME SEÇME!
    console.log("Online mod - mevcut kelime kullanılıyor:", secretWord);
  } else if (!skipWordSelection) {
    // Lokal mod veya Oyuncu 1: Yeni kelime seç
    secretWord = pickRandomWord();
    currentTurn = Math.random() < 0.5 ? "player1" : "player2";
    console.log("Yeni kelime seçildi:", secretWord);
  }
  
  currentRow1 = 0;
  currentRow2 = 0;
  gameOver = false;
  winner = null;
  lockedPositions = [false, false, false, false, false];
  firstLetterHintGiven1 = false;
  firstLetterHintGiven2 = false;
  
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

  createBoard(boardEl1, gridInputs1, guessButton1);
  createBoard(boardEl2, gridInputs2, guessButton2);
  
  // Her iki tahtayı da başlat
  const isPlayer1Turn = currentTurn === "player1";
  const isPlayer2Turn = currentTurn === "player2";
  
  currentRow1 = setActiveRow(gridInputs1, 0, 0, firstLetterHintGiven1, isPlayer1Turn);
  currentRow2 = setActiveRow(gridInputs2, 0, 0, firstLetterHintGiven2, isPlayer2Turn);
  
  // Sıra durumunu güncelle
  updateBoardsForTurn();
  
  console.log("Reset tamamlandı - Kelime:", secretWord, "Sıra:", currentTurn);
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
    console.log('Firebase bağlantısı kuruldu.');
    return true;
  } catch (error) {
    console.error('Firebase başlatılamadı:', error);
    // Firebase olmadan lokal oyun hala çalışır
    return false;
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

// Lokal mod başlat
document.getElementById("localModeBtn").addEventListener("click", async () => {
  if (WORDS.length === 0) {
    alert('Kelimeler yükleniyor, lütfen bekleyin...');
    await loadWords();
  }
  
  isLocalMode = true;
  isOnlineMode = false;
  myPlayerNumber = 0; // Lokal modda her iki oyuncu da oynanabilir
  connectionScreen.style.display = "none";
  gameScreen.style.display = "block";
  document.getElementById("connection-status").style.display = "none";
  document.getElementById("player1Title").textContent = "Oyuncu 1";
  document.getElementById("player2Title").textContent = "Oyuncu 2";
  document.getElementById("disconnectBtn").style.display = "none";
  document.getElementById("backToMenuBtn").style.display = "inline-block";
  resetGame();
});

// Online mod seç
document.getElementById("onlineModeBtn").addEventListener("click", () => {
  document.querySelector(".connection-box").style.display = "none";
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
  document.querySelector(".connection-box").style.display = "block";
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
    document.querySelector(".connection-box").style.display = "block";
    onlineOptions.style.display = "none";
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
        currentRow: 0
      },
      player2: {
        connected: false,
        currentRow: 0
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
    
    // Player2'nin katılmasını bekle
    let hasPlayer2Joined = false;
    currentRoomRef.child('player2/connected').on('value', (snapshot) => {
      if (snapshot.val() === true && !hasPlayer2Joined) {
        hasPlayer2Joined = true;
        console.log("Oyuncu 2 katıldı!");
        
        // Oyun verilerini dinlemeye başla
        listenToGameUpdates();
        
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
      currentRow: 0
    });
    
    // Oyun verilerini al ve SAKLA
    secretWord = roomData.secretWord;
    currentTurn = roomData.currentTurn;
    lockedPositions = roomData.lockedPositions || [false, false, false, false, false];
    currentRow1 = roomData.player1?.currentRow || 0;
    currentRow2 = roomData.player2?.currentRow || 0;
    
    console.log("Odaya katılındı:", roomCode);
    console.log("Kelime Firebase'den alındı:", secretWord);
    console.log("Başlangıç sırası:", currentTurn);
    
    // Oyun verilerini dinle
    listenToGameUpdates();
    
    // Oyunu başlat (board'ları oluştur)
    startOnlineGame();
    
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
      currentTurn = turn;
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
  currentRoomRef.child(otherPlayer + '/connected').on('value', (snapshot) => {
    const isConnected = snapshot.val();
    
    // Rakip hiç bağlanmadıysa (ilk yüklemede false) uyarı gösterme
    if (!hasSeenOpponentConnected) {
      if (isConnected === true) {
        hasSeenOpponentConnected = true;
        statusText.textContent = "🟢 Bağlı";
        opponentName.textContent = "Rakip: Hazır";
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
      opponentName.textContent = "Rakip: Hazır";
    }
  });
}

// Online oyunu başlat
function startOnlineGame() {
  connectionScreen.style.display = "none";
  gameScreen.style.display = "block";
  document.getElementById("connection-status").style.display = "flex";
  document.getElementById("player1Title").textContent = myPlayerNumber === 1 ? "Sen" : "Rakip";
  document.getElementById("player2Title").textContent = myPlayerNumber === 2 ? "Sen" : "Rakip";
  document.getElementById("disconnectBtn").style.display = "inline-block";
  document.getElementById("backToMenuBtn").style.display = "inline-block";
  
  // Her iki oyuncu da board'u oluşturmalı
  if (myPlayerNumber === 1) {
    // Oyun sahibi kelimeyi seçer ve board'u oluşturur
    resetGame();
  } else {
    // Katılan oyuncu board'u oluşturur (kelime zaten Firebase'den alındı)
    resetGame(true); // skipWordSelection = true
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

// Online oyun bitişi
function handleOnlineGameEnd(winnerPlayer) {
  gameOver = true;
  if (guessButton1) guessButton1.disabled = true;
  if (guessButton2) guessButton2.disabled = true;
  
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
  }
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
  document.querySelector(".connection-box").style.display = "block";
  document.querySelector(".online-buttons").style.display = "flex";
  
  isOnlineMode = false;
  myPlayerNumber = 0;
  
  // Oyun durumunu sıfırla
  gameOver = false;
  currentRow1 = 0;
  currentRow2 = 0;
  lockedPositions = [false, false, false, false, false];
}

// ======================
// OYUN LOGİĞİ (Güncellenmiş)
// ======================

guessButton1.addEventListener("click", () => {
  // Online modda sadece kendi sıramda ve kendi oyuncumda tahmin yapabilirim
  if (isOnlineMode && myPlayerNumber !== 1) return;
  if (isLocalMode || (isOnlineMode && myPlayerNumber === 1)) {
    handleGuess("player1", gridInputs1, currentRow1, messageEl1, guessButton1, gridInputs2, currentRow2);
  }
});

guessButton2.addEventListener("click", () => {
  // Online modda sadece kendi sıramda ve kendi oyuncumda tahmin yapabilirim
  if (isOnlineMode && myPlayerNumber !== 2) return;
  if (isLocalMode || (isOnlineMode && myPlayerNumber === 2)) {
    handleGuess("player2", gridInputs2, currentRow2, messageEl2, guessButton2, gridInputs1, currentRow1);
  }
});

resetButton.addEventListener("click", async () => {
  if (isOnlineMode && myPlayerNumber === 1) {
    // Sadece oda sahibi reset yapabilir
    resetGame();
    if (currentRoomRef) {
      try {
        await currentRoomRef.update({
          secretWord: secretWord,
          currentTurn: currentTurn,
          lockedPositions: [false, false, false, false, false],
          gameOver: false,
          winner: null,
          'player1/currentRow': 0,
          'player2/currentRow': 0,
          'player1/lastGuess': null,
          'player2/lastGuess': null
        });
        console.log("Oyun yeniden başlatıldı");
      } catch (error) {
        console.error("Reset gönderme hatası:", error);
      }
    }
  } else if (isLocalMode) {
    resetGame();
  } else if (isOnlineMode && myPlayerNumber === 2) {
    alert("Sadece oda sahibi oyunu yeniden başlatabilir.");
  }
});

// Sayfa yüklendiğinde oyunu başlat
initGame();

