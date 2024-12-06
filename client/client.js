// Initialisation de la connexion Socket.io
const socket = io();
let roomUniqueID = null; // Identifiant unique de la salle
let player1 = false; // Indique si l'utilisateur actuel est le joueur 1

// Fonction pour créer une nouvelle partie
function createGame() {
    if (roomUniqueID) {
        socket.emit('playerQuit', { roomUniqueID: roomUniqueID }); // Quitter l'ancienne salle
    }
    resetGameUI(); // Réinitialiser l'interface utilisateur
    player1 = true; // Le créateur est toujours le joueur 1
    socket.emit('createGame'); // Émettre une demande de création de partie
}

// Fonction pour rejoindre une partie existante
function joinGame() {
    if (roomUniqueID) {
        socket.emit('playerQuit', { roomUniqueID: roomUniqueID }); // Quitter l'ancienne salle
    }
    resetGameUI(); // Réinitialiser l'interface utilisateur
    roomUniqueID = document.getElementById('roomUniqueID').value; // Récupérer l'ID de la salle depuis l'input
    socket.emit('joinGame', { roomUniqueID: roomUniqueID }); // Émettre une demande de rejoindre une partie
}

// Événement déclenché lorsque la partie est créée
socket.on("gameCreated", (data) => {
    roomUniqueID = data.roomUniqueID;
    document.getElementById('initial').style.display = 'none';
    document.getElementById('gamePlay').style.display = 'block';
    document.getElementById('waitingArea').style.display = 'block';
    document.getElementById('gameArea').style.display = 'none';

    let copyButton = document.createElement('button');
    copyButton.style.display = 'block';
    copyButton.classList.add('copy-button');
    copyButton.innerText = "Copier le code";
    copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(roomUniqueID).then(function () {
            console.log('Async: Copying to clipboard was successful!');
        }, function (err) {
            console.error('Async: Could not copy text: ', err);
        });
    });
    document.getElementById('waitingArea').innerHTML = "En attente d'un adversaire, partagez le code " + roomUniqueID + " pour jouer";
    document.getElementById('waitingArea').appendChild(copyButton);
});

// Événement déclenché lorsque les joueurs sont connectés
socket.on("playersConnected", () => {
    document.getElementById('initial').style.display = 'none';
    document.getElementById('gamePlay').style.display = 'block';
    document.getElementById('waitingArea').style.display = 'none';
    document.getElementById('gameArea').style.display = 'block';
    
    // Ajouter ces lignes pour s'assurer que les scores sont affichés
    document.getElementById('scores').style.display = 'block';
    document.getElementById('p1Score').innerText = '0';
    document.getElementById('p2Score').innerText = '0';
    
    updateScoreLabels();

    // S'assurer que les boutons de choix sont présents
    if (document.getElementById('player1Choice').children.length === 0) {
        document.getElementById('player1Choice').innerHTML = `
            <button class="rock" onclick="sendChoice('Cailloux')"></button>
            <button class="paper" onclick="sendChoice('Papier')"></button>
            <button class="scissor" onclick="sendChoice('Ciseaux')"></button>
        `;
    }

    if (document.getElementById('player2Choice').children.length === 0) {
        document.getElementById('player2Choice').innerHTML = `
            <p id="opponentState">En attente de l'adversaire</p>
        `;
    }
});

// Événement déclenché lorsque le joueur 1 fait un choix
socket.on("p1Choice", (data) => {
    if (!player1) {
        createOpponentChoiceButtons(data);
    }
});

// Événement déclenché lorsque le joueur 2 fait un choix
socket.on("p2Choice", (data) => {
    if (player1) {
        createOpponentChoiceButtons(data);
    }
});

// Événement déclenché lorsque le résultat du jeu est disponible
socket.on("result", (data) => {
    let winnerText = '';
    if (data.winner != 'd') {
        if (data.winner == 'p1' && player1) {
            winnerText = "Vous avez gagné";
            document.getElementById('winnerArea').style.color = 'green';
        } else if (data.winner == 'p1') {
            winnerText = "Vous avez perdu";
            document.getElementById('winnerArea').style.color = 'red';
        } else if (data.winner == 'p2' && player1) {
            winnerText = "Vous avez perdu";
            document.getElementById('winnerArea').style.color = 'red';
        } else {    
            winnerText = "Vous avez gagné";
            document.getElementById('winnerArea').style.color = 'green';
        }
    } else {
        winnerText = "C'est une égalité";
        document.getElementById('winnerArea').style.color = 'orange';
    }
    document.getElementById('opponentState').style.display = 'none';
    document.getElementById('opponentButton').style.display = 'block';
    document.getElementById('winnerArea').innerText = winnerText;

    document.getElementById('homeButton').style.display = 'block';

    document.getElementById('p1Score').innerText = data.scores.p1Score;
    document.getElementById('p2Score').innerText = data.scores.p2Score;

    const restartButton = document.getElementById('restartButton');
    if (restartButton) restartButton.style.display = 'block';

    document.getElementById('homeButton').addEventListener('click', () => {
        if (roomUniqueID) {
            socket.emit('playerQuit', { roomUniqueID: roomUniqueID });
            resetGameUI();
        }
    });
});

// Événement déclenché lorsque l'adversaire quitte la partie
socket.on('opponentQuit', () => {
    alert("Votre adversaire a quitté la partie.");
    resetGameUI();
});

// Événement déclenché lorsqu'une demande de redémarrage est en cours
socket.on('restartProgress', (data) => {
    const restartStatus = `Demandes de redémarrage : ${data.restartCount}/${data.totalPlayers}`;
    document.getElementById('winnerArea').innerText = restartStatus; // Mettre à jour l'affichage
});

// Événement déclenché lorsque le jeu est redémarré
socket.on('restartGame', () => { 
    // Réinitialiser l'interface du jeu
    document.getElementById('winnerArea').innerText = "";
    document.getElementById('player1Choice').innerHTML = `
        <button class="rock" onclick="sendChoice('Cailloux')"></button>
        <button class="paper" onclick="sendChoice('Papier')"></button>
        <button class="scissor" onclick="sendChoice('Ciseaux')"></button>`;
    document.getElementById('player2Choice').innerHTML = `
        <p id="opponentState">En attente de l'adversaire</p>`;
    document.getElementById('restartButton').style.display = 'none'; // Cacher le bouton
    document.getElementById('restartButton').disabled = false; // Réactiver le bouton
    document.getElementById('homeButton').style.display = 'none'; // Cacher le bouton
});

// Fonction pour envoyer le choix du joueur
function sendChoice(choice) {
    const choiceEvent = player1 ? 'p1Choice' : 'p2Choice';
    socket.emit(choiceEvent, {
        choice: choice, 
        roomUniqueID: roomUniqueID
    })
    let playerChoiceButton = document.createElement('button');
    playerChoiceButton.style.display = 'block';
    if (choice === 'Ciseaux') {
        playerChoiceButton.classList.add('scissor');
    } else if (choice === 'Cailloux') {
        playerChoiceButton.classList.add('rock');
    } else if (choice === 'Papier') {
        playerChoiceButton.classList.add('paper');
    }
    document.getElementById('player1Choice').innerHTML = "";
    document.getElementById('player1Choice').appendChild(playerChoiceButton);
}

// Fonction pour créer les boutons de choix de l'adversaire
function createOpponentChoiceButtons(data) {
    document.getElementById('opponentState').innerHTML = "Votre adversaire a choisi";
    let opponentButton = document.createElement('button');
    opponentButton.id = 'opponentButton';
    opponentButton.style.display = 'none';
    if (data.choice === 'Ciseaux') {
        opponentButton.classList.add('scissor');
    } else if (data.choice === 'Cailloux') {
        opponentButton.classList.add('rock');
    } else if (data.choice === 'Papier') {
        opponentButton.classList.add('paper');
    }
    document.getElementById('player2Choice').appendChild(opponentButton);
}

// Fonction pour redémarrer le jeu
function restartGame() {
    socket.emit('restartRequest', { roomUniqueID: roomUniqueID });
    document.getElementById('restartButton').disabled = true; // Désactive le bouton temporairement
}

// Fonction pour réinitialiser l'interface utilisateur du jeu
function resetGameUI() {
    // Réinitialiser l'affichage des zones
    document.getElementById('gamePlay').style.display = 'none';
    document.getElementById('initial').style.display = 'block';
    document.getElementById('gameArea').style.display = 'none';
    document.getElementById('waitingArea').style.display = 'none';
    document.getElementById('scores').style.display = 'none'; // Cacher les scores

    // Réinitialiser les scores à 0
    document.getElementById('p1Score').innerText = '0';
    document.getElementById('p2Score').innerText = '0';

    // Réinitialiser le contenu des zones de jeu
    document.getElementById('player1Choice').innerHTML = `
        <button class="rock" onclick="sendChoice('Cailloux')"></button>
        <button class="paper" onclick="sendChoice('Papier')"></button>
        <button class="scissor" onclick="sendChoice('Ciseaux')"></button>
    `;
    document.getElementById('player2Choice').innerHTML = `
        <p id="opponentState">En attente de l'adversaire</p>
    `;
    document.getElementById('winnerArea').innerHTML = '';
    document.getElementById('homeButton').style.display = 'none';
    document.getElementById('restartButton').style.display = 'none';

    // Réinitialiser les variables
    player1 = false;
    roomUniqueID = null;
}

// Fonction pour mettre à jour les étiquettes des scores
function updateScoreLabels() {
    if (player1) {
        document.getElementById('labelP1').innerText = "Toi";
        document.getElementById('labelP2').innerText = "Adversaire";
    } else {
        document.getElementById('labelP1').innerText = "Adversaire";
        document.getElementById('labelP2').innerText = "Toi";
    }
}
