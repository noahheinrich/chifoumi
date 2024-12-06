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

socket.on("gameCreated", (data) => {
    roomUniqueID = data.roomUniqueID; // Stocker l'identifiant unique de la salle
    // Modifier l'interface pour montrer la salle d'attente
    document.getElementById('initial').style.display = 'none';
    document.getElementById('gamePlay').style.display = 'block';
    document.getElementById('waitingArea').style.display = 'block';
    document.getElementById('gameArea').style.display = 'none';

    // Ajouter un bouton pour copier le code de la salle
    let copyButton = document.createElement('button');
    copyButton.style.display = 'block';
    copyButton.classList.add('copy-button');
    copyButton.innerText = "Copier le code";
    copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(roomUniqueID).then(() => {
            console.log('Copie réussie !');
        }).catch((err) => {
            console.error('Erreur lors de la copie : ', err);
        });
    });
    document.getElementById('waitingArea').innerHTML = "En attente d'un adversaire, partagez le code " + roomUniqueID + " pour jouer";
    document.getElementById('waitingArea').appendChild(copyButton);
});

socket.on("playersConnected", () => {
    // Mise à jour de l'interface pour passer au jeu
    document.getElementById('initial').style.display = 'none';
    document.getElementById('gamePlay').style.display = 'block';
    document.getElementById('waitingArea').style.display = 'none';
    document.getElementById('gameArea').style.display = 'block';

    // Afficher les scores initiaux
    document.getElementById('scores').style.display = 'block';
    document.getElementById('p1Score').innerText = '0';
    document.getElementById('p2Score').innerText = '0';

    updateScoreLabels(); // Ajuster les étiquettes selon le joueur (Toi/Adversaire)

    // Ajouter les boutons de choix si nécessaire
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

socket.on("p1Choice", (data) => {
    if (!player1) {
        createOpponentChoiceButtons(data); // Créer un bouton pour montrer le choix de l'adversaire
    }
});

socket.on("p2Choice", (data) => {
    if (player1) {
        createOpponentChoiceButtons(data);
    }
});

socket.on("result", (data) => {
    let winnerText = ''; // Initialisation du texte pour afficher le résultat.

    // Vérification si le jeu n'est pas une égalité.
    if (data.winner != 'd') {
        // Si le joueur 1 est le gagnant et que l'utilisateur est le joueur 1.
        if (data.winner == 'p1' && player1) {
            winnerText = "Vous avez gagné"; // Message indiquant la victoire.
            document.getElementById('winnerArea').style.color = 'green'; // Texte en vert pour une victoire.
        }
        // Si le joueur 1 est le gagnant mais l'utilisateur n'est pas le joueur 1.
        else if (data.winner == 'p1') {
            winnerText = "Vous avez perdu"; // Message indiquant la défaite.
            document.getElementById('winnerArea').style.color = 'red'; // Texte en rouge pour une défaite.
        }
        // Si le joueur 2 est le gagnant et que l'utilisateur est le joueur 1.
        else if (data.winner == 'p2' && player1) {
            winnerText = "Vous avez perdu"; // Message indiquant la défaite.
            document.getElementById('winnerArea').style.color = 'red'; // Texte en rouge pour une défaite.
        }
        // Sinon, le joueur 2 est le gagnant et l'utilisateur n'est pas le joueur 1.
        else {
            winnerText = "Vous avez gagné"; // Message indiquant la victoire.
            document.getElementById('winnerArea').style.color = 'green'; // Texte en vert pour une victoire.
        }
    } else {
        // Cas où le jeu se termine par une égalité.
        winnerText = "C'est une égalité"; // Message pour une égalité.
        document.getElementById('winnerArea').style.color = 'orange'; // Texte en orange pour une égalité.
    }

    // Masque l'état actuel de l'adversaire et affiche son choix.
    document.getElementById('opponentState').style.display = 'none';
    document.getElementById('opponentButton').style.display = 'block';

    // Affiche le texte correspondant au résultat.
    document.getElementById('winnerArea').innerText = winnerText;

    // Affiche le bouton pour revenir à l'accueil.
    document.getElementById('homeButton').style.display = 'block';

    // Met à jour les scores affichés avec les données reçues.
    document.getElementById('p1Score').innerText = data.scores.p1Score; // Score du joueur 1.
    document.getElementById('p2Score').innerText = data.scores.p2Score; // Score du joueur 2.

    // Vérifie si le bouton de redémarrage existe et l'affiche.
    const restartButton = document.getElementById('restartButton');
    if (restartButton) restartButton.style.display = 'block';

    // Ajoute un événement au bouton "Home" pour permettre au joueur de quitter la partie.
    document.getElementById('homeButton').addEventListener('click', () => {
        if (roomUniqueID) {
            // Informe le serveur que le joueur quitte la partie.
            socket.emit('playerQuit', { roomUniqueID: roomUniqueID });
            // Réinitialise l'interface utilisateur.
            resetGameUI();
        }
    });
});

socket.on('opponentQuit', () => {
    alert("Votre adversaire a quitté la partie.");
    resetGameUI(); // Réinitialiser l'interface utilisateur
});

socket.on('restartGame', () => {
    // Réinitialiser l'interface pour recommencer une nouvelle manche
    resetGameUI();
});

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

// Fonction pour envoyer le choix du joueur au serveur.
function sendChoice(choice) {
    // Détermine quel événement envoyer en fonction du rôle du joueur (player1 ou non).
    const choiceEvent = player1 ? 'p1Choice' : 'p2Choice';

    // Envoie le choix du joueur au serveur avec l'ID unique de la salle.
    socket.emit(choiceEvent, {
        choice: choice,
        roomUniqueID: roomUniqueID
    });

    // Crée un bouton pour représenter visuellement le choix du joueur dans l'interface.
    let playerChoiceButton = document.createElement('button');
    playerChoiceButton.style.display = 'block'; // Rend le bouton visible.

    // Ajoute une classe CSS spécifique au bouton en fonction du choix (Ciseaux, Cailloux, ou Papier).
    if (choice === 'Ciseaux') {
        playerChoiceButton.classList.add('scissor');
    } else if (choice === 'Cailloux') {
        playerChoiceButton.classList.add('rock');
    } else if (choice === 'Papier') {
        playerChoiceButton.classList.add('paper');
    }

    // Remplace tout le contenu de la zone "player1Choice" par le nouveau bouton.
    document.getElementById('player1Choice').innerHTML = "";
    document.getElementById('player1Choice').appendChild(playerChoiceButton);
}

// Fonction pour créer les boutons représentant le choix de l'adversaire.
function createOpponentChoiceButtons(data) {
    // Met à jour l'état affiché pour indiquer que l'adversaire a fait un choix.
    document.getElementById('opponentState').innerHTML = "Votre adversaire a choisi";

    // Crée un bouton pour représenter le choix de l'adversaire dans l'interface.
    let opponentButton = document.createElement('button');
    opponentButton.id = 'opponentButton'; // Attribue un ID unique au bouton.
    opponentButton.style.display = 'none'; // Rend le bouton caché par défaut.

    // Ajoute une classe CSS spécifique au bouton en fonction du choix de l'adversaire.
    if (data.choice === 'Ciseaux') {
        opponentButton.classList.add('scissor');
    } else if (data.choice === 'Cailloux') {
        opponentButton.classList.add('rock');
    } else if (data.choice === 'Papier') {
        opponentButton.classList.add('paper');
    }

    // Ajoute le bouton dans la zone "player2Choice" de l'interface.
    document.getElementById('player2Choice').appendChild(opponentButton);
}

// Fonction pour demander un redémarrage de la partie au serveur.
function restartGame() {
    // Envoie une demande de redémarrage au serveur avec l'ID unique de la salle.
    socket.emit('restartRequest', { roomUniqueID: roomUniqueID });

    // Désactive temporairement le bouton de redémarrage pour éviter des clics multiples.
    document.getElementById('restartButton').disabled = true;
}

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


// Fonction pour mettre à jour les étiquettes des scores des joueurs dans l'interface.
function updateScoreLabels() {
    // Si le joueur actuel est "player1".
    if (player1) {
        // Met à jour les étiquettes pour indiquer que le joueur actuel est "Toi".
        document.getElementById('labelP1').innerText = "Toi";
        document.getElementById('labelP2').innerText = "Adversaire";
    } else {
        // Si le joueur actuel est "player2", inverse les étiquettes.
        document.getElementById('labelP1').innerText = "Adversaire";
        document.getElementById('labelP2').innerText = "Toi";
    }
}


