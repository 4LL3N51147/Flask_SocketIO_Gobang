class Player:
    def __init__(self, id, username, room):
        self.id = id
        self.username = username
        self.room = room

    def joinRoom(self, room):
        self.room = room