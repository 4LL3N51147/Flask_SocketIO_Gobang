# Flask_SocketIO_Gobang

This is a Gobang game implemented using Flask and Socket.IO

Requirements:
Flask
```
pip install flask
```
Flask_socketio
```
pip install flask-socketio
```

Start the Flask server with:
```
python server.py
```

Then players can join the lobby by opening in the browser http://127.0.0.1:5000/.

After there are at least 2 players in the lobby, you can invite the other player and start a game.

Todos:
- [ ] Finish my changesThe userlist becomes clipped onto the chessboard if the window size is less than 1000, causing part of the border unclickable
