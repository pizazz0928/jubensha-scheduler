import { stdin, stdout } from "node:process";
import { hashPassword } from "../server/auth.mjs";

async function readHiddenPassword() {
  stdout.write("请输入新密码，至少 10 个字符: ");
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      resolve(value);
    };
    stdin.on("data", (key) => {
      if (key === "\u0003") {
        stdin.setRawMode(false);
        reject(new Error("已取消"));
      } else if (key === "\r" || key === "\n") {
        finish();
      } else if (key === "\u007f" || key === "\b") {
        value = value.slice(0, -1);
      } else {
        value += key;
      }
    });
  });
}

let password;
if (stdin.isTTY) {
  password = await readHiddenPassword();
} else {
  password = "";
  stdin.setEncoding("utf8");
  for await (const chunk of stdin) password += chunk;
  password = password.replace(/^\uFEFF/, "").replace(/[\r\n]+$/, "");
}
stdout.write(`${hashPassword(password)}\n`);
