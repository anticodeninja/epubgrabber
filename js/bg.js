"use strict";

function parseMHTML(data, callback) {
    const fileReader = new FileReader();
    const boundaryRegex = /boundary="(\S+)"/;
    const lineRegex = /\r\n|\n\r|\r|\n/;
    const files = [];

    let boundary = null;
    let item = null;
    let payload = false;

    fileReader.addEventListener("loadend", function() {
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

        callback(files);
    });

    fileReader.readAsText(data);
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

    return decodeURIComponent(escape(buffer));
}

function assembleBase64(type, payload) {
    return "data:" + type + ";base64," + payload.replace(/[^A-Za-z0-9+\/=]/g, "");
}

function simplifyAndSave(files) {
    const blankGif = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const imageTypes = ["image/jpeg", "image/gif", "image/png", "image/svg+xml"];

    const temp = document.createElement("div");
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

    chrome.runtime.sendMessage({
        action: "save_page",
        location: files[0].headers.location,
        title: title,
        html: html
    });
}

function saveToEpub() {
    chrome.tabs.getSelected(null, function(tab) {
        chrome.pageCapture.saveAsMHTML({ tabId: tab.id }, function(data) {
            parseMHTML(data, function(files){
                simplifyAndSave(files);
            });
        });
    });
}

chrome.runtime.onMessage.addListener(function(message, sender, callback) {
    if (message.action == "save_to_epub") {
	saveToEpub();
    } else if (message.action == "save_page") {
        chrome.storage.local.get("savedItems", function (data) {
            let savedItems = data.savedItems || {
                counter: 1,
                list: []
            };

            let info = {
                id: savedItems.counter,
                title: message.title,
                location: message.location
            }

            savedItems.list.push(info);
            savedItems.counter += 1;

            let saveData = {}
            saveData["savedItem" + info.id] = message.html;

            chrome.storage.local.set({savedItems: savedItems}, function(){
                console.log("info saved");
            });
            chrome.storage.local.set(saveData, function(){
                console.log("data saved");
            });
        });
        console.log(message);
    }
});
