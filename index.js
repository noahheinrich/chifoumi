const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

const rooms = {};

app.use(express.static(path.join(__dirname, 'client')));    

app.get('/', (req, res) => {
    res.send(__dirname + '/client/index.html');
});

io.on('connection', (socket) => {
    const playerRooms = new Map();
    
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });

    socket.on('createGame', () => {
        const roomUniqueID = makeID(6);
        rooms[roomUniqueID] = {
            p1Score: 0,
            p2Score: 0,
            p1Choice: null,
            p2Choice: null,
            restartRequests: new Set()
        };
        socket.join(roomUniqueID);
        socket.emit('gameCreated', {
            roomUniqueID: roomUniqueID,
            scores: {
                p1Score: 0,
                p2Score: 0
            }
        });
    });

    socket.on('joinGame', (data) => {
        if (rooms[data.roomUniqueID]) {
            socket.join(data.roomUniqueID);
            playerRooms.set(socket.id, data.roomUniqueID);
            socket.to(data.roomUniqueID).emit('playersConnected');
            socket.emit("playersConnected", {
                scores: {
                    p1Score: rooms[data.roomUniqueID].p1Score,
                    p2Score: rooms[data.roomUniqueID].p2Score
                }
            });
        }
    });

    socket.on('p1Choice', (data) => {
        let choice = data.choice;
        rooms[data.roomUniqueID].p1Choice = choice;
        socket.to(data.roomUniqueID).emit('p1Choice', { choice: data.choice });
        if (rooms[data.roomUniqueID].p2Choice != null) {
            declareWinner(data.roomUniqueID);
        }
    });

    socket.on('p2Choice', (data) => {
        let choice = data.choice;
        rooms[data.roomUniqueID].p2Choice = choice;
        socket.to(data.roomUniqueID).emit('p2Choice', { choice: data.choice });
        if (rooms[data.roomUniqueID].p1Choice != null) {
            declareWinner(data.roomUniqueID);
        }
    });

    socket.on('restartGame', (data) => {
        const roomID = data.roomUniqueID;

        // Réinitialiser les choix pour la salle
        if (rooms[roomID]) {
            rooms[roomID].p1Choice = null;
            rooms[roomID].p2Choice = null;
        }

        // Informer les joueurs que la partie est relancée
        io.sockets.to(roomID).emit('gameRestarted');
    });

    socket.on('restartRequest', (data) => {
        const room = rooms[data.roomUniqueID];
        if (!room) return; // Vérifie si la salle existe

        // Initialiser la liste des joueurs ayant demandé un redémarrage
        if (!room.restartRequests) {
            room.restartRequests = new Set(); // Utilise un Set pour éviter les doublons
        }

        // Si le joueur n'a pas déjà demandé, on ajoute sa requête
        if (!room.restartRequests.has(socket.id)) {
            room.restartRequests.add(socket.id);
            room.restartCount = room.restartRequests.size; // Compte le nombre de requêtes

            // Notifie les joueurs de la progression
            io.to(data.roomUniqueID).emit('restartProgress', {
                restartCount: room.restartCount,
                totalPlayers: 2 // Supposons toujours 2 joueurs
            });

            // Si les deux joueurs ont demandé un redémarrage
            if (room.restartCount === 2) {
                room.restartRequests.clear(); // Réinitialise la liste
                room.restartCount = 0; // Réinitialise le compteur

                // Réinitialiser les choix pour la salle
                room.p1Choice = null;
                room.p2Choice = null;

                // Notifie tous les joueurs que le jeu redémarre
                io.to(data.roomUniqueID).emit('restartGame');
            }
        }
    });

    socket.on('playerQuit', (data) => {
        const roomID = data.roomUniqueID;

        if (rooms[roomID]) {
            // Informer tous les autres joueurs dans la salle
            socket.to(roomID).emit('opponentQuit');

            // Faire quitter le socket de la salle
            socket.leave(roomID);

            // Supprimer la salle si elle existe
            delete rooms[roomID];

            // Nettoyer les références
            playerRooms.delete(socket.id);
        }
    });

    socket.on('disconnect', () => {
        const roomID = playerRooms.get(socket.id);
        if (roomID && rooms[roomID]) {
            // Informer les autres joueurs
            socket.to(roomID).emit('opponentQuit');

            // Nettoyer la salle
            delete rooms[roomID];
            playerRooms.delete(socket.id);
        }
    });

});

function declareWinner(roomUniqueID) {
    let p1Choice = rooms[roomUniqueID].p1Choice;
    let p2Choice = rooms[roomUniqueID].p2Choice;
    let winner = null;

    if (p1Choice === p2Choice) {
        winner = "d";
    } else if (p1Choice == "Papier") {
        if (p2Choice == "Ciseaux") {
            winner = "p2";
        } else {
            winner = "p1";
        }
    } else if (p1Choice == "Cailloux") {
        if (p2Choice == "Papier") {
            winner = "p2";
        } else {
            winner = "p1";
        }
    } else if (p1Choice == "Ciseaux") {
        if (p2Choice == "Cailloux") {
            winner = "p2";
        } else {
            winner = "p1";
        }
    }

    if (winner === "p1") {
        rooms[roomUniqueID].p1Score++;
    } else if (winner === "p2") {
        rooms[roomUniqueID].p2Score++;
    }

    io.sockets.to(roomUniqueID).emit("result", {
        winner: winner,
        scores: {
            p1Score: rooms[roomUniqueID].p1Score,
            p2Score: rooms[roomUniqueID].p2Score,
        }
    });
    rooms[roomUniqueID].p1Choice = null;
    rooms[roomUniqueID].p2Choice = null;
}

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});

function makeID(lenght) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLenght = characters.length;
    for (var i = 0; i < lenght; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLenght));
    }
    return result;
} 


