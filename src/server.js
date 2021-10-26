import http from "http";
import { Server } from "socket.io";
import express from "express";

const app = express();

const handleListen = () => console.log(`Listening on http://localhost:3000`);

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer);

let userList = [];
let users = [];

// 開発サーバの駆動は「npm run dev」で！
// 下のブロックから機能実装！
wsServer.on("connection", (socket) => {
  //// ソケットのリスニング例
  // socket.on("イベント名", (arg1, arg2, ...) => {
  //    処理...
  // });
  //
  //ルーム参加処理
  socket.on('join-room', function({username, roomid, ipaddress, language}, callback) {
    try{
      //接続中のクライアントのIPアドレスのチェック
      if(socket.client.conn.remoteAddress == ipaddress){
        userList.push({username});
        users.push({
            socketid: socket.id, 
            ipaddres: ipaddress, 
            roomid: roomid,
            username: username,
            language: language
        });
        socket.join(roomid);
        callback();
        //ユーザー参加通知のemit処理
        io.sockets.emit('join-room-effect', userList);
        //本体クライアントの入室時画面切り替え処理

      }else{
          //ない場合は決めていない
          //テスト用に例外エラーを生成
          throw new error();
      }
    }catch(e){
        console.error(e.message);
    }
  });

  //// ソケットのエミット例
  // socket.to("受信するユーザまたは会議ルーム").emit("イベント名", (arg1, arg2, ...) => {
  //    処理...
  // });
});

httpServer.listen(3000, handleListen);
