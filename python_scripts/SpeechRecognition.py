import speech_recognition as sr
import socketio
import datetime

sio = socketio.Client()
sio.connect('http://localhost:4000/')

print("なにか話してください")


def send_detected_voice(text, time):
    detestedVoice = {}
    detestedVoice["comment"] = text
    detestedVoice["time"] = time
    return detestedVoice


# 音声入力
while True:

    r = sr.Recognizer()
    with sr.Microphone() as source:
        audio = r.listen(source)

    try:
        # Google Web Speech APIで音声認識 ko-KR  en-US ja-JP
        text = r.recognize_google(audio, language="ja-JP")

    except sr.UnknownValueError:
        print("音声を認識できませんでした")

    except sr.RequestError as e:
        print("音声認識を要求できませんでした: {0}".format(e))

    else:
        print(text)

    finally:
        time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        formated_time = str(time)
        sio.emit('send-detected-voice', send_detected_voice(text, formated_time))

    # 종료합니다 韓国語で終了しますの意味
    if text == "終了します":
        break