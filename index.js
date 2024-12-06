// Importation des modules nécessaires
const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// Objet pour stocker les informations des salles
const rooms = {};

// Middleware pour servir les fichiers statiques depuis le dossier 'client'
app.use(express.static(path.join(__dirname, 'client')));

// Route principale pour servir le fichier HTML de l'application
app.get('/', (req, res) => {
    res.send(__dirname + '/client/index.html');
});

// Gestion des connexions WebSocket
io.on('connection', (socket) => {
    // Map pour suivre la salle associée à chaque joueur
    const playerRooms = new Map();

    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });

    // Création d'une nouvelle partie
    socket.on('createGame', () => {
        const roomUniqueID = makeID(6); // Génère un ID unique pour la salle
        rooms[roomUniqueID] = {
            p1Score: 0,
            p2Score: 0,
            p1Choice: null,
            p2Choice: null,
            restartRequests: new Set()
        };
        socket.join(roomUniqueID); // Le joueur rejoint la salle
        socket.emit('gameCreated', {
            roomUniqueID: roomUniqueID,
            scores: { p1Score: 0, p2Score: 0 }
        });
    });

    // Un joueur rejoint une salle existante
    socket.on('joinGame', (data) => {
        if (rooms[data.roomUniqueID]) {
            socket.join(data.roomUniqueID);
            playerRooms.set(socket.id, data.roomUniqueID); // Associe le joueur à la salle
            socket.to(data.roomUniqueID).emit('playersConnected'); // Notifie les autres joueurs
            socket.emit("playersConnected", {
                scores: {
                    p1Score: rooms[data.roomUniqueID].p1Score,
                    p2Score: rooms[data.roomUniqueID].p2Score
                }
            });
        }
    });

    // Gestion du choix du joueur 1
    socket.on('p1Choice', (data) => {
        rooms[data.roomUniqueID].p1Choice = data.choice;
        socket.to(data.roomUniqueID).emit('p1Choice', { choice: data.choice });
        // Si les deux joueurs ont choisi, déterminer le gagnant
        if (rooms[data.roomUniqueID].p2Choice != null) {
            declareWinner(data.roomUniqueID);
        }
    });

    // Gestion du choix du joueur 2
    socket.on('p2Choice', (data) => {
        rooms[data.roomUniqueID].p2Choice = data.choice;
        socket.to(data.roomUniqueID).emit('p2Choice', { choice: data.choice });
        // Si les deux joueurs ont choisi, déterminer le gagnant
        if (rooms[data.roomUniqueID].p1Choice != null) {
            declareWinner(data.roomUniqueID);
        }
    });

    // Redémarrage du jeu après un accord mutuel
    socket.on('restartRequest', (data) => {
        const room = rooms[data.roomUniqueID];
        if (!room) return;

        // Enregistre la demande de redémarrage
        if (!room.restartRequests.has(socket.id)) {
            room.restartRequests.add(socket.id);

            // Envoie l'état actuel des demandes de redémarrage
            io.to(data.roomUniqueID).emit('restartProgress', {
                restartCount: room.restartRequests.size,
                totalPlayers: 2
            });

            // Si tous les joueurs ont demandé un redémarrage, réinitialise la partie
            if (room.restartRequests.size === 2) {
                room.restartRequests.clear();
                room.p1Choice = null;
                room.p2Choice = null;
                io.to(data.roomUniqueID).emit('restartGame');
            }
        }
    });

    // Gestion de la déconnexion d'un joueur
    socket.on('playerQuit', (data) => {
        const roomID = data.roomUniqueID;
        if (rooms[roomID]) {
            socket.to(roomID).emit('opponentQuit'); // Notifie l'adversaire
            socket.leave(roomID); // Retire le joueur de la salle
            delete rooms[roomID]; // Supprime la salle
            playerRooms.delete(socket.id); // Nettoie les références
        }
    });

    // Gestion de la déconnexion physique d'un joueur
    socket.on('disconnect', () => {
        const roomID = playerRooms.get(socket.id);
        if (roomID && rooms[roomID]) {
            socket.to(roomID).emit('opponentQuit');
            delete rooms[roomID];
            playerRooms.delete(socket.id);
        }
    });
});

// Déterminer le gagnant d'une manche
function declareWinner(roomUniqueID) {
    const room = rooms[roomUniqueID];
    const { p1Choice, p2Choice } = room;

    let winner = null;
    if (p1Choice === p2Choice) {
        winner = "d"; // Égalité
    } else if ((p1Choice === "Papier" && p2Choice === "Cailloux") ||
        (p1Choice === "Cailloux" && p2Choice === "Ciseaux") ||
        (p1Choice === "Ciseaux" && p2Choice === "Papier")) {
        winner = "p1";
        room.p1Score++; // Incrémente le score de P1
    } else {
        winner = "p2";
        room.p2Score++; // Incrémente le score de P2
    }

    // Envoie le résultat et les scores à tous les joueurs
    io.sockets.to(roomUniqueID).emit("result", {
        winner,
        scores: { p1Score: room.p1Score, p2Score: room.p2Score }
    });

    // Réinitialise les choix pour la prochaine manche
    room.p1Choice = null;
    room.p2Choice = null;
}

// Démarrer le serveur
server.listen(3000, () => {
    console.log('Server is running on port 3000');
});

// Génère un ID unique pour identifier les salles
function makeID(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
}
