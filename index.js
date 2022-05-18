import config from "./config.js";
import { Telegraf } from 'telegraf';
import lines from "./chatlines.js";
import * as fs from "fs";
import axios from "axios";

import NodeGoogleDrive from "google-drive-connect";

let groupData = {};
const auth = JSON.parse(fs.readFileSync('./auth.json'));
let fileQueue = {};


const loadData = () => {
    try {
        if (fs.existsSync("./groupdata.json")) {
            groupData = JSON.parse(fs.readFileSync('./groupdata.json'));
        }
        if (fs.existsSync("./filequeue.json")) {
            fileQueue = JSON.parse(fs.readFileSync('./filequeue.json'));
        }
    } catch(err) {
        console.error(err);
    }
}

const saveData = () => {
    try {
        fs.writeFileSync('./groupdata.json', JSON.stringify(groupData));
        fs.writeFileSync('./filequeue.json', JSON.stringify(fileQueue));
    } catch (err) {
        console.error(err);
    }
}

loadData();

const bot = new Telegraf(config.token)
bot.start((ctx) => {
    if(auth['@' + ctx.from.username]) {
        if (!groupData[ctx.message.chat.id]) {
            let text = ctx.message.text;
            groupData[ctx.message.chat.id] = {};
            if(text.split(" ").length === 2) {
                let [_, num] = text.split(" ");
                groupData[ctx.message.chat.id].entry_number = num;
                ctx.reply(lines.ru.normal.setup_complete);
                saveData();
            } else {
                ctx.reply(lines.ru.normal.entry);
                ctx.reply(lines.ru.normal.request_en);
                groupData[ctx.message.chat.id].awaitingValue = "entry_number";
                saveData();
            }



        } else {
            ctx.reply(lines.ru.error.already_created);
        }
    } else {
        ctx.reply(lines.ru.error.no_access)
    }


});

const attach = (ctx) => {
    let chatid = ctx.message.chat.id;
    let dt = groupData[chatid];
    dt[dt.awaitingValue] = ctx.message.text;
    return dt.awaitingValue;
}

let googleDriveInstance = null;
let authenticatedGoogleDrive = false;

async function authenticateGoogleDrive() {
    googleDriveInstance = new NodeGoogleDrive({
        ROOT_FOLDER: config.docsFolder
    });

    await googleDriveInstance.useServiceAccountAuth(
        config.serviceAccount
    );
    console.log("AUTHENTICATED TO GDRIVE")
    authenticatedGoogleDrive = true;
}

async function uploadFileWithID(ctx, entryNum, type, file) {
    if(!authenticatedGoogleDrive) {
        console.log("ERR; not authenticated");
        return;
    }

    let folderResponse = await googleDriveInstance.listFolders(
        config.docsFolder,
        null,
        false
    );

    let folders = folderResponse.folders;
    let targetFolder = null;
    for(let i = 0; i < folders.length; i++) {
        let f_temp = folders[i];
        if(f_temp.name === entryNum) {
            targetFolder = f_temp;
        }
    }

    // If no folder for this entry:
    if(!targetFolder) {
        let newFolder = await googleDriveInstance.createFolder(
            config.docsFolder,
            entryNum
        );
        targetFolder = newFolder;
    }

    folderResponse = await googleDriveInstance.listFolders(
        targetFolder.id,
        null,
        false
    );

    let subfolder = null;
    if(type === "count") {
      subfolder = {id: targetFolder.id}
    } else {
      folders = folderResponse.folders;
      for (let i = 0; i < folders.length; i++) {
        let f_temp = folders[i];
        if (f_temp.name === type) {
          subfolder = f_temp;
        }
      }
      // if no subfolder:
      if (!subfolder) {
        let newFolder = await googleDriveInstance.createFolder(
          targetFolder.id,
          type
        );
        subfolder = newFolder;
      }
    }


    // actually upload
    let url = await ctx.telegram.getFileLink(file.file_id)
    let stream = await axios.get(url.toString(), {responseType: 'arraybuffer'});

    await googleDriveInstance.create({
        source: stream.data,
        parentFolder: subfolder.id,
        name: file.file_name,
        mimeType: file.mime_type
    });


}

bot.on('message', (ctx) => {
    let chatid = ctx.message.chat.id;
    if(groupData[chatid]) {

        if(ctx.message.document || ctx.message.photo) {
            let doc = null;

            if(ctx.message.document) {
                doc = ctx.message.document;
            } else {
                doc = ctx.message.photo[ctx.message.photo.length - 1];
                doc.mime_type = 'image/jpeg';
                doc.file_name = "uploaded_image_" + Date.now() + ".jpeg"
            }

            ctx.reply(lines.ru.normal.document_detected(ctx.from.username), {
                reply_markup: {
                    inline_keyboard: [
                        [ { text: lines.ru.context.count, callback_data: "ctx-count" }],
                        [ { text: lines.ru.context.passport, callback_data: "ctx-passport" } ],
                        [ { text: lines.ru.context.other, callback_data: "ctx-other" } ],
                        [ { text: lines.ru.context.cancel, callback_data: "ctx-cancel" } ]
                    ]
                }
            }).then((msg) => {
                let queueId = msg.chat.id + ":" + msg.message_id;
                let dt = groupData[msg.chat.id];
                fileQueue[queueId] = {chatID: msg.chat.id, messageID: msg.message_id, entry_number: dt.entry_number, document: doc};
                saveData();

            })
            return;
        }


        let dt = groupData[chatid];
        if(dt.awaitingValue) {
            let type = attach(ctx);
            switch(type) {
                case "entry_number":
                    ctx.reply(lines.ru.normal.setup_complete);
                    dt.awaitingValue = null;
                    break;
                case "coord_email":
                    ctx.reply(lines.ru.normal.setup_complete);
                    dt.awaitingValue = null;
                    break;
                default:
                    break;
            }
            saveData();
        }

        if(auth['@' + ctx.from.username]) {
            let messageText = ctx.message.text;
            if(messageText.startsWith("/clear")) {
                let dt = groupData[chatid];
                if(dt) {
                    ctx.reply("This session has been cleared. You may bind a new one with /start");
                    delete groupData[chatid];
                    saveData();
                } else {
                    ctx.reply(lines.ru.error.no_session);
                }
            }
        }


    } else {
        if(auth['@' + ctx.from.username]) {
          if((Date.now() - ctx.message.date) < 20000) {
            ctx.reply(lines.ru.error.no_session);
          }
        }
    }
});

bot.action("ctx-count", (ctx) => {
    let msg = ctx.update.callback_query.message
    let data = fileQueue[msg.chat.id + ":" + msg.message_id];

    uploadFileWithID(ctx, data.entry_number, "count", data.document);
    ctx.reply(lines.ru.normal.upload(data.document.file_name, "count"));
    delete fileQueue[msg.chat.id + ":" + msg.message_id];
    saveData();
    ctx.deleteMessage();
});

bot.action("ctx-other", (ctx) => {
    let msg = ctx.update.callback_query.message
    let data = fileQueue[msg.chat.id + ":" + msg.message_id];

    uploadFileWithID(ctx, data.entry_number, "other", data.document);
    ctx.reply(lines.ru.normal.upload(data.document.file_name, "other"));
    delete fileQueue[msg.chat.id + ":" + msg.message_id];
    saveData();
    ctx.deleteMessage();
});

bot.action("ctx-passport", (ctx) => {
    let msg = ctx.update.callback_query.message
    let data = fileQueue[msg.chat.id + ":" + msg.message_id];

    uploadFileWithID(ctx, data.entry_number, "passport", data.document);
    ctx.reply(lines.ru.normal.upload(data.document.file_name, "passport"));
    delete fileQueue[msg.chat.id + ":" + msg.message_id];
    saveData();
    ctx.deleteMessage();
});

bot.action("ctx-cancel", (ctx) => {
    let msg = ctx.update.callback_query.message;
    delete fileQueue[msg.chat.id + ":" + msg.message_id];
    saveData();
    ctx.deleteMessage();
})


console.log("BOT START");
authenticateGoogleDrive();
bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))