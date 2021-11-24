import socketio
import datetime

sio = socketio.Client()


@sio.event
def connect():
    print("接続開始")
    sio.emit('send-detected-voice', send_detected_voice())
    sio.emit("send-detected-gesture", send_detected_gesture())


@sio.event
def disconnect():
    print('サーバとの接続が切断されました')


def send_detected_voice():
    now = datetime.datetime.now()
    return {"comment":"音声認識","time":now.strftime("%Y-%m-%d %H:%M")}


def send_detected_gesture():
    now = datetime.datetime.now()
    return {"reaction":"手話認識","time":now.strftime("%Y-%m-%d %H:%M")}


sio.on('connect', connect)
sio.connect('http://192.168.2.7:4000/')
sio.wait()
