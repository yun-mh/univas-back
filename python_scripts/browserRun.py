import paramiko
import time

with paramiko.SSHClient() as ssh:
    # 初回ログイン時の「Are you sure you want to continue connecting (yes/no)?」対策
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        # ssh接続
        ssh.connect('[IPアドレス]', port=22, username='[ユーザー名]', password='[パスワード]')
        # ブラウザ再起動
        stdin, stdout, stderr = ssh.exec_command('pkill -f chromium')
        time.sleep(0.1)
        stdin, stdout, stderr = ssh.exec_command('DISPLAY=:0 chromium-browser [URL] --kiosk')
        
        print('browser is running...')
    except err as e:
        print(e.message);