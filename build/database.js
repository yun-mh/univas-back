"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Database = void 0;

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _sqlite = _interopRequireDefault(require("sqlite3"));

var Database = /*#__PURE__*/function () {
  function Database() {
    (0, _classCallCheck2["default"])(this, Database);
    this.init();
  }

  (0, _createClass2["default"])(Database, [{
    key: "init",
    value: function init() {
      this.db = new _sqlite["default"].Database("./log.db");
      this.db.run("CREATE TABLE IF NOT EXISTS log(roomId, logUrl)");
    }
  }, {
    key: "get",
    value: function () {
      var _get = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee(query, params) {
        var _this = this;

        return _regenerator["default"].wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                return _context.abrupt("return", new Promise(function (resolve, reject) {
                  _this.db.get(query, params, function (err, row) {
                    if (err) {
                      return reject(err);
                    }

                    resolve(row);
                  });
                }));

              case 1:
              case "end":
                return _context.stop();
            }
          }
        }, _callee);
      }));

      function get(_x, _x2) {
        return _get.apply(this, arguments);
      }

      return get;
    }()
  }, {
    key: "insert",
    value: function insert(query, args) {
      var _this$db;

      (_this$db = this.db).run.apply(_this$db, [query].concat((0, _toConsumableArray2["default"])(args)));
    }
  }, {
    key: "close",
    value: function close() {
      this.db.close();
    }
  }]);
  return Database;
}();

exports.Database = Database;
//# sourceMappingURL=database.js.map