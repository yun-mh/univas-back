import paramiko
import time

with paramiko.SSHClient() as ssh:
    # 初回ログイン時の「Are you sure you want to continue connecting (yes/no)?」対策
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        # ssh接続
        ssh.connect('192.168.2.100', port=22, username='taka', password='1109takaaki')
        # ブラウザ再起動
        stdin, stdout, stderr = ssh.exec_command('pkill -f chromium')
        time.sleep(0.1)
        stdin, stdout, stderr = ssh.exec_command('DISPLAY=:0 chromium-browser http://192.168.2.7:4000/device.html --kiosk')
        
        print('browser is running...')
    
    except err as e:
        print('error')