"use strict";

function parseMHTML(data, callback) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader(),
              boundaryRegex = /boundary="(\S+)"/,
              lineRegex = /\r\n|\n\r|\r|\n/,
              files = [];

        let boundary = null,
            item = null,
            payload = false;

        fileReader.addEventListener("onerror", (err) => reject(err));

        fileReader.addEventListener("loadend", () => {
            try {
                const lines = fileReader.result.split(lineRegex);

                for (let i = 0; i < lines.length; ++i) {
                    const line = lines[i];
                    if (boundary !== null) {
                        if (line.search(boundary) === -1) {
                            if (item !== null) {
                                if (payload) {
                                    item.payload += line + "\n";
                                } else {
                                    if (line.length != 0) {
                                        const delIndex = line.search(":");
                                        const headerName = line.substr(0, delIndex).trim();
                                        const headerValue = line.substr(delIndex + 1).trim();
                                        if (headerName == "Content-Type") {
                                            item.headers.type = headerValue;
                                        } else if (headerName == "Content-Transfer-Encoding") {
                                            item.headers.encoding = headerValue;
                                        } else if (headerName == "Content-Location") {
                                            item.headers.location = headerValue;
                                        } else {
                                            console.log(line);
                                        }
                                    } else {
                                        payload = true;
                                    }
                                }
                            }
                        } else {
                            if (item !== null) {
                                files.push(item);
                            }

                            item = {
                                headers: {},
                                payload: ""
                            };
                            payload = false;
                        }
                    } else {
                        const capture = boundaryRegex.exec(line);
                        if (capture !== null) {
                            boundary = capture[1];
                        }
                    }
                }
                resolve(files);
            } catch (err) {
                reject(err);
            }
        });

        fileReader.readAsText(data);
    });
}

function decodeQuotedPrintable(value) {
    let buffer = "";
    let index = 0;

    while (index < value.length) {
        if (value[index] === "=") {
            if (value[index+1] !== "\n") {
                buffer += String.fromCharCode(parseInt(value[index+1] + value[index+2], 16));
                index += 3;
            } else {
                index += 2;
            }
        } else {
            buffer += value[index++];
        }
    }

    let encoding = /content="text\/html;\s+charset=(\S+)"/.exec(buffer);
    let encoded = null;

    if (encoding !== null) {
        if (encoding[1] === "cp1251" || encoding[1] === "windows-1251") {
            encoded = convert_cp1251_to_utf8(buffer);
        }
    }

    if (encoded === null) {
        encoded = normalize_utf8(buffer);
    }

    return encoded;
}

function assembleBase64(type, payload) {
    return "data:" + type + ";base64," + payload.replace(/[^A-Za-z0-9+\/=]/g, "");
}

function simplifyAndSave(files) {
    return new Promise((resolve, reject) => {
        const blankGif = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
              imageTypes = ["image/jpeg", "image/gif", "image/png", "image/svg+xml"],
              temp = document.createElement("div");

        temp.innerHTML = decodeQuotedPrintable(files[0].payload);

        const images = {};
        for (let i = 0; i < files.length; ++i) {
            const file = files[i];

            if (imageTypes.indexOf(file.headers.type) === -1) {
                console.log(file.headers);
                continue;
            }

            if (file.headers.encoding !== "base64") {
                continue;
            }

            images[file.headers.location] = assembleBase64(file.headers.type, file.payload);
        }

        const titleNode = temp.querySelector("title");
        const title = titleNode ? titleNode.innerText : "";

        const html = preparePage(temp, {
            replaceImage: function(src){
                let image = images[src];
                return image || blankGif;
            }});

        resolve(chromep.storage.sync.get(null).then((data) => {
            data.indexer = data.indexer || {
                counter: 1,
                list: []
            };

            let id = null,
                info = {
                    "title": title,
                    "location": files[0].headers.location
                };

            // TODO make configurable
            for (let i = 0, l = data.indexer.list.length; i < l; ++i) {
                let existId = data.indexer.list[i];
                if (data['info_' + existId].location == files[0].headers.location) {
                    id = existId;
                    break;
                }
            }

            if (!id) {
                id = data.indexer.counter++;
                data.indexer.list.push(id);
            }

            let metadata = { "indexer": data.indexer },
                savedata = {};
            metadata["info_" + id] = info;
            savedata["data_" + id] = html;

            return chromep.storage.sync.set(metadata).then(() => {
                return chromep.storage.local.set(savedata);
            });
        }));
    });
}

function saveToStorage(errHandler) {
    chromep.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        return chromep.pageCapture.saveAsMHTML({ tabId: tabs[0].id });
    }).then((data) => {
        return parseMHTML(data);
    }).then((files) => {
        return simplifyAndSave(files);
    }).then(() => {
        chrome.runtime.sendMessage({
            action: 'page_saved',
            result: null
        });
    }).catch((err) => {
        chrome.runtime.sendMessage({
            action: 'page_saved',
            result: err.message
        });
    });
}

function simplifyPageImpl() {
    let newBody = "";

    for (let i = 0; i < remove.length; ++i) {
        let blocks = document.querySelectorAll(remove[i]);
        for (let j = 0; j < blocks.length; ++j) {
            blocks[j].remove();
        }
    }

    for (let i = 0; i < take.length; ++i) {
        let blocks = document.querySelectorAll(take[i]);
        for (let j = 0; j < blocks.length; ++j) {
            newBody += blocks[j].innerHTML;
        }
    }

    document.body.innerHTML = newBody;
    document.body.innerHTML = preparePage(document.body);
}

function simplifyPage() {
    let tab, script;

    chromep.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        tab = tabs[0];
        return getPageSettings(tab.url);
    }).then((config) => {
        script = '(function() {\n';
        script += 'var take = ' + JSON.stringify(splitFilter(config.take)) + ',\n';
        script += '    remove = ' + JSON.stringify(splitFilter(config.remove)) + ';\n';
        script += '(' + simplifyPageImpl.toString() + ')();\n';
        script += '})();';

        return chromep.tabs.executeScript(tab.id, { file: 'js/common.js' });
    }).then(() => {
        return chromep.tabs.executeScript(tab.id, { file: 'js/epub.js' });
    }).then(() => {
        return chromep.tabs.executeScript(tab.id, { code: script });
    }).then(() => {
        chrome.runtime.sendMessage({
            action: 'page_simplified',
            result: null
        });
    }).catch((err) => {
        chrome.runtime.sendMessage({
            action: 'page_simplified',
            result: err.message
        });
    });
}

chrome.runtime.onMessage.addListener(function(message, sender, callback) {
    if (message.action == "save_to_storage") {
	saveToStorage();
    } else if (message.action == 'simplify_page') {
        simplifyPage();
    }
});

