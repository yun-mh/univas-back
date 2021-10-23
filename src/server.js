import http from "http";
import { Server } from "socket.io";
import express from "express";

const app = express();

const handleListen = () => console.log(`Listening on http://localhost:3000`);

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer);

// エラー処理関数
function emitError(socket, target, errorMsg) {
  socket.to(target).emit("error", { errorMsg });
}

// 開発サーバの駆動は「npm run dev」で！
// 下のブロックから機能実装！
wsServer.on("connection", (socket) => {
  // アクセシビリティ更新(S -> B)
  socket.on(
    "change-accessibility",
    ({ fontSize_per, fontColor, ipaddress }) => {
      // 本体の識別値をusers配列の中からfor文使って取得し、そのデータから該当のsocketIdを取得
      // アクセシビリティ更新通知(B -> R)
      try {
        socket
          .to(ipaddress)
          .emit("change-accessibility-effect", { fontSize_per, fontColor });
      } catch (e) {
        emitError(socket, ipaddress, "エラーが発生しました。");
      }
    }
  );

  // 議題変更(S -> B)
  socket.on("updated-title", ({ roomId, title }) => {
    // データ架空の必要があれば処理して
    // 議題変更通知(B -> R)
    try {
      socket.to(roomId).emit("updated-title-effect", { title });
    } catch (e) {
      emitError(socket, ipaddress, "エラーが発生しました。");
    }
  });

  // モード切替(S -> B)
  socket.on("change-mode", ({ macaddress, mode }) => {
    // 本体の識別値を架空・処理
    // モード切替通知(B -> R)
    socket.to(macaddress).emit("change-mode-effect", { mode });
  });
});

httpServer.listen(3000, handleListen);
