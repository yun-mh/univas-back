// git test by yumiba.

import http from "http";
import { Server } from "socket.io";
import express from "express";

const app = express();

const handleListen = () => console.log(`Listening on http://localhost:3000`);

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer);

// 開発サーバの駆動は「npm run dev」で！
// 下のブロックから機能実装！
wsServer.on("connection", (socket) => {
  //// ソケットのリスニング例
  // socket.on("イベント名", (arg1, arg2, ...) => {
  //    処理...
  // });
  //
  //// ソケットのエミット例
  // socket.to("受信するユーザまたは会議ルーム").emit("イベント名", (arg1, arg2, ...) => {
  //    処理...
  // });
});

httpServer.listen(3000, handleListen);
