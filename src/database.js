import sqlite3 from "sqlite3";

export class Database {
  constructor() {
    this.init();
  }

  init() {
    this.db = new sqlite3.Database("./log.db");
    this.db.run("CREATE TABLE IF NOT EXISTS log(roomId, logUrl)");
  }

  async get(query, params) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) {
          return reject(err);
        }
        resolve(row);
      });
    });
  }

  insert(query, args) {
    this.db.run(query, ...args);
  }

  close() {
    this.db.close();
  }
}
