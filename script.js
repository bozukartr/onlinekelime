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

// PeerJS değişkenleri
let peer = null;
let connection = null;
let myPeerId = null;

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
  
  for (let c = 0; c < COLS; c++) {
    const input = gridInputs[currentRow][c];
    if (lockedPositions[c] && !input.classList.contains("hint")) {
      input.value = secretWord[c];
      input.disabled = true;
      input.classList.add("correct", "locked");
    } else if (!lockedPositions[c]) {
      // Sıra olmayan oyuncunun kutularını kapat
      input.disabled = !isCurrentPlayer;
    }
  }
}

// Sıra değiştiğinde tüm tahtaları güncelle
function updateBoardsForTurn() {
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
  guessButton1.disabled = !isPlayer1Turn || gameOver;
  guessButton2.disabled = !isPlayer2Turn || gameOver;
  
  // Oyuncu bölümlerine görsel efekt ekle
  const player1Section = boardEl1.parentElement;
  const player2Section = boardEl2.parentElement;
  
  if (isPlayer1Turn) {
    player1Section.classList.add("active");
    player2Section.classList.remove("active");
  } else {
    player2Section.classList.add("active");
    player1Section.classList.remove("active");
  }
  
  // Sıra mesajlarını göster
  if (!gameOver) {
    if (isPlayer1Turn && currentRow1 < ROWS) {
      messageEl1.textContent = "Senin sıran! ⏰";
      messageEl1.className = "message neutral";
      if (currentRow2 < ROWS) {
        messageEl2.textContent = "Rakip oynuyor...";
        messageEl2.className = "message neutral";
      }
    } else if (isPlayer2Turn && currentRow2 < ROWS) {
      messageEl2.textContent = "Senin sıran! ⏰";
      messageEl2.className = "message neutral";
      if (currentRow1 < ROWS) {
        messageEl1.textContent = "Rakip oynuyor...";
        messageEl1.className = "message neutral";
      }
    }
    
    // Sıra olan oyuncunun aktif kutusuna odaklan
    if (isPlayer1Turn && currentRow1 < ROWS) {
      for (let c = 0; c < COLS; c++) {
        const input = gridInputs1[currentRow1][c];
        if (!input.disabled) {
          input.focus();
          break;
        }
      }
    } else if (isPlayer2Turn && currentRow2 < ROWS) {
      for (let c = 0; c < COLS; c++) {
        const input = gridInputs2[currentRow2][c];
        if (!input.disabled) {
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
      sendData({
        type: "guess",
        playerName: playerName,
        guess: guess,
        result: result,
        newLockedPositions: lockedPositions,
        newCurrentRow: currentRow + 1,
        newTurn: currentTurn,
        winner: playerName
      });
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
      sendData({
        type: "guess",
        playerName: playerName,
        guess: guess,
        result: result,
        newLockedPositions: lockedPositions,
        newCurrentRow: currentRow,
        newTurn: currentTurn,
        winner: null
      });
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
    sendData({
      type: "guess",
      playerName: playerName,
      guess: guess,
      result: result,
      newLockedPositions: lockedPositions,
      newCurrentRow: currentRow,
      newTurn: currentTurn,
      winner: null
    });
  }
  
  // Tüm tahtaları yeni sıra için güncelle
  updateBoardsForTurn();
}

function resetGame(skipWordSelection = false) {
  // Sadece oda sahibi kelime seçebilir (online modda)
  if (!skipWordSelection) {
    secretWord = pickRandomWord();
    currentTurn = Math.random() < 0.5 ? "player1" : "player2";
  }
  
  currentRow1 = 0;
  currentRow2 = 0;
  gameOver = false;
  winner = null;
  lockedPositions = [false, false, false, false, false];
  firstLetterHintGiven1 = false;
  firstLetterHintGiven2 = false;
  
  messageEl1.textContent = "";
  messageEl1.className = "message";
  messageEl2.textContent = "";
  messageEl2.className = "message";
  
  guessButton1.disabled = false;
  guessButton2.disabled = false;

  createBoard(boardEl1, gridInputs1, guessButton1);
  createBoard(boardEl2, gridInputs2, guessButton2);
  
  // Her iki tahtayı da başlat
  const isPlayer1Turn = currentTurn === "player1";
  const isPlayer2Turn = currentTurn === "player2";
  
  currentRow1 = setActiveRow(gridInputs1, 0, 0, firstLetterHintGiven1, isPlayer1Turn);
  currentRow2 = setActiveRow(gridInputs2, 0, 0, firstLetterHintGiven2, isPlayer2Turn);
  
  // Sıra durumunu güncelle
  updateBoardsForTurn();
  
  // console.log("DEBUG kelime:", secretWord);
}

// ======================
// ONLINE MULTIPLAYER LOGIC
// ======================

// Sayfa yüklendiğinde kelimeleri yükle
async function initGame() {
  const loaded = await loadWords();
  if (loaded) {
    console.log('Oyun hazır!');
  }
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
  const roomCode = roomCodeInput.value.trim();
  if (roomCode) {
    if (roomCode.length < 10) {
      alert("Oda kodu çok kısa. Lütfen tam oda kodunu girin.");
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

// Oda oluştur
function createRoom() {
  isOnlineMode = true;
  myPlayerNumber = 1; // Oda sahibi Oyuncu 1
  
  // PeerJS bağlantısı oluştur (alternatif sunucu ayarları ile)
  try {
    peer = new Peer({
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });
  } catch (error) {
    console.error("Peer oluşturma hatası:", error);
    alert("Bağlantı başlatılamadı. Lütfen sayfayı yenileyin.");
    return;
  }
  
  peer.on("open", (id) => {
    myPeerId = id;
    // Tüm ID'yi göster (daha güvenilir)
    roomCodeDisplay.value = id;
    document.querySelector(".online-buttons").style.display = "none";
    roomInfo.style.display = "block";
    
    console.log("Oda ID'si:", id);
    
    // Diğer oyuncudan gelen bağlantıyı dinle
    peer.on("connection", (conn) => {
      console.log("Yeni bağlantı alındı:", conn.peer);
      connection = conn;
      setupConnection();
      
      // Bağlandı, oyunu başlat
      setTimeout(() => {
        startOnlineGame();
      }, 500);
    });
  });
  
  peer.on("error", (err) => {
    console.error("Peer error:", err);
    let errorMsg = "Bağlantı hatası: ";
    if (err.type === "unavailable-id") {
      errorMsg = "Oda ID'si kullanılamıyor. Lütfen tekrar deneyin.";
    } else if (err.type === "peer-unavailable") {
      errorMsg = "Rakip bulunamadı. Oda kodu doğru mu?";
    } else if (err.type === "network") {
      errorMsg = "Ağ bağlantı hatası. İnternet bağlantınızı kontrol edin.";
    } else if (err.type === "server-error") {
      errorMsg = "Sunucu hatası. Lütfen birkaç saniye sonra tekrar deneyin.";
    } else {
      errorMsg += err.type;
    }
    alert(errorMsg);
  });
}

// Odaya katıl
function joinRoom(roomCode) {
  isOnlineMode = true;
  myPlayerNumber = 2; // Katılan oyuncu Oyuncu 2
  
  // PeerJS bağlantısı oluştur (alternatif sunucu ayarları ile)
  try {
    peer = new Peer({
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });
  } catch (error) {
    console.error("Peer oluşturma hatası:", error);
    alert("Bağlantı başlatılamadı. Lütfen sayfayı yenileyin.");
    return;
  }
  
  peer.on("open", () => {
    console.log("Bağlantı hazır, odaya katılınıyor:", roomCode);
    
    // Direkt verilen kodu kullan (tam ID)
    connection = peer.connect(roomCode, {
      reliable: true
    });
    
    if (!connection) {
      alert("Bağlantı oluşturulamadı. Oda kodu doğru mu?");
      document.querySelector(".online-buttons").style.display = "block";
      joinForm.style.display = "none";
      return;
    }
    
    setupConnection();
    
    connection.on("open", () => {
      console.log("Bağlantı başarılı!");
      setTimeout(() => {
        startOnlineGame();
      }, 500);
    });
    
    connection.on("error", (err) => {
      console.error("Connection error:", err);
      alert("Bağlantı hatası: " + err);
      document.querySelector(".online-buttons").style.display = "block";
      joinForm.style.display = "none";
    });
  });
  
  peer.on("error", (err) => {
    console.error("Peer error:", err);
    let errorMsg = "Bağlantı hatası: ";
    if (err.type === "peer-unavailable") {
      errorMsg = "Oda bulunamadı. Kod doğru mu kontrol edin.";
    } else if (err.type === "network") {
      errorMsg = "Ağ bağlantı hatası. İnternet bağlantınızı kontrol edin.";
    } else if (err.type === "server-error") {
      errorMsg = "Sunucu hatası. Lütfen birkaç saniye sonra tekrar deneyin.";
    } else {
      errorMsg += err.type;
    }
    alert(errorMsg);
    document.querySelector(".online-buttons").style.display = "block";
    joinForm.style.display = "none";
  });
}

// Bağlantıyı kur ve mesajlaşmayı ayarla
function setupConnection() {
  connection.on("open", () => {
    statusText.textContent = "🟢 Bağlı";
    opponentName.textContent = "Rakip: Hazır";
    
    // İlk veri gönder (senkronizasyon için)
    if (myPlayerNumber === 1) {
      sendData({
        type: "sync",
        secretWord: secretWord,
        currentTurn: currentTurn
      });
    }
  });
  
  connection.on("data", (data) => {
    handleReceivedData(data);
  });
  
  connection.on("close", () => {
    statusText.textContent = "🔴 Bağlantı Kesildi";
    opponentName.textContent = "Rakip: Ayrıldı";
    alert("Rakip bağlantıyı kesti.");
  });
  
  connection.on("error", (err) => {
    console.error("Connection error:", err);
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
  
  // Oyun sahibi kelimeyi seçer
  if (myPlayerNumber === 1) {
    resetGame();
  }
}

// Veri gönder
function sendData(data) {
  if (connection && connection.open) {
    connection.send(data);
  }
}

// Gelen veriyi işle
function handleReceivedData(data) {
  switch (data.type) {
    case "sync":
      // Oyun başlangıç senkronizasyonu
      secretWord = data.secretWord;
      currentTurn = data.currentTurn;
      resetGame(true); // Kelimeyi değiştirme
      break;
      
    case "guess":
      // Rakip tahmin yaptı
      const { playerName, guess, result, newLockedPositions, newCurrentRow } = data;
      
      // Diğer oyuncunun tahminini güncelle
      if (playerName === "player1" && myPlayerNumber === 2) {
        // Rakip oyuncu 1
        currentRow1 = newCurrentRow - 1;
        applyGuessToBoard(gridInputs1, currentRow1, guess, result);
        currentRow1 = newCurrentRow;
      } else if (playerName === "player2" && myPlayerNumber === 1) {
        // Rakip oyuncu 2
        currentRow2 = newCurrentRow - 1;
        applyGuessToBoard(gridInputs2, currentRow2, guess, result);
        currentRow2 = newCurrentRow;
      }
      
      // Kilitli pozisyonları güncelle
      lockedPositions = newLockedPositions;
      currentTurn = data.newTurn;
      
      // Kazanan kontrolü
      if (data.winner) {
        handleOpponentWin(playerName);
      }
      
      updateBoardsForTurn();
      break;
      
    case "reset":
      // Rakip yeniden başlattı
      secretWord = data.secretWord;
      currentTurn = data.currentTurn;
      resetGame(true);
      break;
  }
}

// Rakibin tahminini tahtaya uygula
function applyGuessToBoard(gridInputs, rowIndex, guess, result) {
  for (let c = 0; c < COLS; c++) {
    const input = gridInputs[rowIndex][c];
    input.value = guess[c];
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

// Rakip kazandı
function handleOpponentWin(playerName) {
  gameOver = true;
  guessButton1.disabled = true;
  guessButton2.disabled = true;
  
  if (playerName === "player1" && myPlayerNumber === 2) {
    messageEl1.textContent = "🎉 KAZANDI! Kelime: " + secretWord;
    messageEl1.className = "message win";
    messageEl2.textContent = "😔 Kaybettin! Kelime: " + secretWord;
    messageEl2.className = "message lose";
  } else if (playerName === "player2" && myPlayerNumber === 1) {
    messageEl2.textContent = "🎉 KAZANDI! Kelime: " + secretWord;
    messageEl2.className = "message win";
    messageEl1.textContent = "😔 Kaybettin! Kelime: " + secretWord;
    messageEl1.className = "message lose";
  }
}

// Bağlantıyı kes
function disconnect() {
  if (connection) {
    connection.close();
    connection = null;
  }
  if (peer) {
    peer.destroy();
    peer = null;
  }
  
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

resetButton.addEventListener("click", () => {
  if (isOnlineMode && myPlayerNumber === 1) {
    // Sadece oda sahibi reset yapabilir
    resetGame();
    sendData({
      type: "reset",
      secretWord: secretWord,
      currentTurn: currentTurn
    });
  } else if (isLocalMode) {
    resetGame();
  } else if (isOnlineMode && myPlayerNumber === 2) {
    alert("Sadece oda sahibi oyunu yeniden başlatabilir.");
  }
});

// Sayfa yüklendiğinde oyunu başlat
initGame();

