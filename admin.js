// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getDatabase, ref, onValue, set, update, remove } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

// --- START: YOUR FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBZ9VKH0SVMOYdvYOO_XY_ycjB0C1ty_BU",
    authDomain: "play-2b9e2.firebaseapp.com",
    // IMPORTANT: You must create a Realtime Database in your Firebase project and add its URL here.
    databaseURL: "https://play-2b9e2-default-rtdb.firebaseio.com",
    projectId: "play-2b9e2",
    storageBucket: "play-2b9e2.appspot.com",
    messagingSenderId: "717502298791",
    appId: "1:717502298791:web:a170ed9239e5df21987982",
    measurementId: "G-97HGFBY9QJ"
};
// --- END: YOUR FIREBASE CONFIGURATION ---

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// DOM Elements
const loginForm = document.getElementById('login-form');
const dashboard = document.getElementById('dashboard');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('login-error');
const adminEmail = document.getElementById('admin-email');
const startGameBtn = document.getElementById('start-game-btn');
const endGameBtn = document.getElementById('end-game-btn');
const resetGameBtn = document.getElementById('reset-game-btn');
const gameStateDisplay = document.getElementById('game-state-display');
const adminNumberBoard = document.getElementById('admin-number-board');
const setPriceBtn = document.getElementById('set-price-btn');
const generateTicketsBtn = document.getElementById('generate-tickets-btn');
const setStartTimeBtn = document.getElementById('set-start-time-btn');
const ticketsList = document.getElementById('tickets-management-list');
const awardsList = document.getElementById('awards-list');
const winnersList = document.getElementById('winners-list');
const addAwardBtn = document.getElementById('add-award-btn');

// Game state reference
const gameRef = ref(database, 'tambolaGame/activeGame');
let currentGameState = {};
const synth = window.speechSynthesis;

// --- Authentication ---
onAuthStateChanged(auth, user => {
    if (user) {
        loginForm.style.display = 'none';
        dashboard.style.display = 'block';
        adminEmail.textContent = user.email;
        initDashboard();
    } else {
        loginForm.style.display = 'block';
        dashboard.style.display = 'none';
    }
});

loginBtn.addEventListener('click', () => {
    signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
        .catch(error => { loginError.textContent = error.message; });
});

logoutBtn.addEventListener('click', () => signOut(auth));


// --- Dashboard Initialization ---
function initDashboard() {
    createAdminBoard();
    
    onValue(gameRef, (snapshot) => {
        currentGameState = snapshot.val() || {};
        updateAdminUI();
        checkAllWinners();
    });
    
    startGameBtn.addEventListener('click', () => update(gameRef, { gameState: 'running' }));
    endGameBtn.addEventListener('click', () => update(gameRef, { gameState: 'ended' }));
    resetGameBtn.addEventListener('click', resetGame);
    setPriceBtn.addEventListener('click', () => update(gameRef, { ticketPrice: Number(document.getElementById('ticket-price').value) }));
    setStartTimeBtn.addEventListener('click', () => update(gameRef, { gameStartTime: new Date(document.getElementById('game-start-time').value).getTime() }));
    generateTicketsBtn.addEventListener('click', () => generateAndSaveTickets(Number(document.getElementById('ticket-limit').value)));
    addAwardBtn.addEventListener('click', addAward);
}

function createAdminBoard() {
    adminNumberBoard.innerHTML = '';
    for (let i = 1; i <= 90; i++) {
        const numberDiv = document.createElement('div');
        numberDiv.className = 'admin-number';
        numberDiv.textContent = i;
        numberDiv.dataset.number = i;
        numberDiv.addEventListener('click', () => callNumber(i));
        adminNumberBoard.appendChild(numberDiv);
    }
}

// --- UI Update Functions ---
function updateAdminUI() {
    gameStateDisplay.textContent = `Current State: ${currentGameState.gameState || 'Not Set'}`;
    
    document.querySelectorAll('.admin-number').forEach(el => {
        el.classList.toggle('called', currentGameState.calledNumbers && currentGameState.calledNumbers[el.dataset.number]);
    });

    ticketsList.innerHTML = '';
    if (currentGameState.tickets) {
        Object.values(currentGameState.tickets).forEach(ticket => {
            const item = document.createElement('div');
            item.className = 'ticket-admin-item';
            item.innerHTML = `
                <span>Ticket #${ticket.ticketNumber}</span>
                <input type="text" value="${ticket.owner}" placeholder="Owner Name" id="owner-for-${ticket.ticketNumber}">
                <button class="primary" data-ticket-id="${ticket.ticketNumber}">Save</button>
            `;
            item.querySelector('button').addEventListener('click', (e) => saveTicketOwner(e.target.dataset.ticketId));
            ticketsList.appendChild(item);
        });
    }

    awardsList.innerHTML = '';
    winnersList.innerHTML = '';
    if (currentGameState.awards) {
        Object.entries(currentGameState.awards).forEach(([key, award]) => {
            const awardItem = document.createElement('li');
            awardItem.innerHTML = `<span>${award.name} (₹${award.prize})</span> <button data-key="${key}" class="end">X</button>`;
            awardItem.querySelector('button').onclick = () => remove(ref(database, `tambolaGame/activeGame/awards/${key}`));
            awardsList.appendChild(awardItem);
            
            if(award.winner) {
                const winnerItem = document.createElement('li');
                winnerItem.innerHTML = `<span>${award.name}:</span> ${award.winner.owner} (Ticket #${award.winner.ticketNumber})`;
                winnersList.appendChild(winnerItem);
            }
        });
    }
}

// --- Voice Synthesis for Number Calling ---
function numberToWords(num) {
    const single = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
    if (num < 10) return single[num];
    if (num === 90) return "nine zero, ninety";
    const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
    const teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];

    if (num < 20) return teens[num - 10];
    
    const ten = Math.floor(num / 10);
    const one = num % 10;

    let parts = [];
    parts.push(single[ten]);
    parts.push(single[one]);

    return `${parts.join(' ')}, ${tens[ten]}${one > 0 ? ' ' + single[one] : ''}`;
}

function announceNumber(num) {
    if (synth.speaking) return;
    const text = (num < 10) ? `Number ${numberToWords(num)}` : `Number ${numberToWords(num)}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = synth.getVoices().find(v => v.name.includes('Google US English') && v.lang.includes('en-US')) || synth.getVoices()[0];
    utterance.rate = 0.9;
    synth.speak(utterance);
}

// --- Game Logic Functions ---
function callNumber(num) {
    if(currentGameState.gameState !== 'running' || (currentGameState.calledNumbers && currentGameState.calledNumbers[num])) {
        return;
    }
    announceNumber(num);
    const updates = {};
    updates[`/calledNumbers/${num}`] = true;
    update(gameRef, updates);
}

function saveTicketOwner(ticketId) {
    const ownerName = document.getElementById(`owner-for-${ticketId}`).value;
    update(ref(database, `tambolaGame/activeGame/tickets/ticket_${ticketId}`), { owner: ownerName });
}

function addAward() {
    const awardName = document.getElementById('award-name').value.trim();
    const awardPrize = document.getElementById('award-prize').value;
    if (!awardName || !awardPrize) return;

    const key = awardName.toLowerCase().replace(/\s+/g, '');
    const updates = {};
    updates[`/awards/${key}`] = { name: awardName, prize: Number(awardPrize), winner: null };
    update(gameRef, updates);
    document.getElementById('award-name').value = '';
    document.getElementById('award-prize').value = '';
}

function resetGame() {
    if (!confirm("Are you sure? This will reset called numbers, winners, and unbook all tickets.")) return;
    
    const newState = { ...currentGameState, gameState: 'stopped', calledNumbers: null };
    if(newState.awards) Object.keys(newState.awards).forEach(k => newState.awards[k].winner = null);
    if(newState.tickets) Object.keys(newState.tickets).forEach(k => newState.tickets[k].owner = 'Unbooked');

    set(gameRef, newState);
}

// --- Ticket Generation ---
function generateAndSaveTickets(limit) {
    if (!limit || limit <= 0) return alert("Please enter a valid ticket limit.");
    
    const tickets = {};
    const generatedRows = new Set(); // To prevent duplicate rows across all tickets

    for (let i = 1; i <= limit; i++) {
        tickets[`ticket_${i}`] = {
            ticketNumber: i,
            owner: 'Unbooked',
            numbers: generateTambolaTicket(generatedRows)
        };
    }
    
    update(gameRef, { tickets: tickets, ticketLimit: limit });
    alert(`${limit} unique tickets generated successfully!`);
}

function generateTambolaTicket(generatedRows) {
    let ticket;
    let isUnique = false;
    // Keep generating tickets until we find one whose rows are unique
    while(!isUnique){
        ticket = Array(3).fill(null).map(() => Array(9).fill(null));
        let numbersInTicket = new Set();
        
        // Step 1: Place 1 number in each column
        for (let c = 0; c < 9; c++) {
            const start = c * 10 + (c === 0 ? 1 : 0);
            const end = c * 10 + 9;
            let num = Math.floor(Math.random() * (end - start + 1)) + start;
            if(c === 8) num = Math.floor(Math.random() * (90 - 80 + 1)) + 80;

            numbersInTicket.add(num);
            let row = Math.floor(Math.random() * 3);
            ticket[row][c] = num;
        }

        // Step 2: Place remaining 6 numbers to ensure 5 per row
        let remaining = 6;
        while(remaining > 0){
            let r = Math.floor(Math.random() * 3);
            let c = Math.floor(Math.random() * 9);

            const rowCount = ticket[r].filter(n => n !== null).length;
            if(ticket[r][c] === null && rowCount < 5){
                const start = c * 10 + (c === 0 ? 1 : 0);
                const end = c * 10 + 9;
                let num;
                do {
                    num = Math.floor(Math.random() * (end - start + 1)) + start;
                    if(c === 8) num = Math.floor(Math.random() * (90 - 80 + 1)) + 80;
                } while (numbersInTicket.has(num));
                
                ticket[r][c] = num;
                numbersInTicket.add(num);
                remaining--;
            }
        }
        
        // Step 3: Sort numbers within each column
        for (let c = 0; c < 9; c++) {
            let colVals = [];
            for(let r = 0; r < 3; r++) if(ticket[r][c] !== null) colVals.push(ticket[r][c]);
            colVals.sort((a,b) => a-b);
            let valIndex = 0;
            for(let r = 0; r < 3; r++) if(ticket[r][c] !== null) ticket[r][c] = colVals[valIndex++];
        }

        // Step 4: Check for row uniqueness
        let ticketRowsString = ticket.map(row => JSON.stringify(row.filter(n => n !== null).sort((a,b) => a-b)));
        if (!ticketRowsString.some(rowStr => generatedRows.has(rowStr))) {
            isUnique = true;
            ticketRowsString.forEach(rowStr => generatedRows.add(rowStr));
        }
    }
    return ticket;
}


// --- Winner Detection Logic ---
function checkAllWinners() {
    if (!currentGameState.tickets || !currentGameState.awards || !currentGameState.calledNumbers) return;
    const { calledNumbers, tickets, awards } = currentGameState;

    Object.entries(awards).forEach(([key, award]) => {
        if (award.winner) return;

        const winningTicket = Object.values(tickets).find(ticket => {
            const ticketNumbers = ticket.numbers.flat().filter(n => n !== null);
            
            switch (key) {
                case 'fullhouse':
                    return ticketNumbers.every(num => calledNumbers[num]);
                case 'firstrow':
                    return ticket.numbers[0].filter(n => n !== null).every(num => calledNumbers[num]);
                case 'secondrow':
                    return ticket.numbers[1].filter(n => n !== null).every(num => calledNumbers[num]);
                case 'thirdrow':
                    return ticket.numbers[2].filter(n => n !== null).every(num => calledNumbers[num]);
                default:
                    return false;
            }
        });

        if (winningTicket) {
            console.log(`Winner for ${award.name}: Ticket #${winningTicket.ticketNumber}`);
            const winnerInfo = { owner: winningTicket.owner, ticketNumber: winningTicket.ticketNumber };
            update(ref(database, `tambolaGame/activeGame/awards/${key}`), { winner: winnerInfo });
        }
    });
}

