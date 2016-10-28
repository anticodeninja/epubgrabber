"use strict";

let savedItems;

let ctrSavedPages;
let ctrSelectAll;
let ctrExportEpub;

function getPageInfo(id) {
    for (let i = 0; i < savedItems.list.length; ++i) {
        if (savedItems.list[i].id == id) {
            return savedItems.list[i];
        }
    }
}

function initialize() {
    chrome.storage.local.get("savedItems", function (data) {
        savedItems = data.savedItems || {
            counter: 1,
            list: []
        };
        
        renderTable();
    });
}

function renderTable() {
    let output = "<table>";

    output += "<tr><th></th><th>Title</th><th>Location</th><th></th></tr>";

    for (let i = 0; i < savedItems.list.length; ++i) {
        let item = savedItems.list[i];
        output += "<tr>";
        output += "<td>" +
            "<input class=\"export_page\" data-id=\"" + item.id + "\" type=\"checkbox\"/>" +
            "</td>";
        output += "<td>" + item.title + "</td>";
        output += "<td><a href=\"" + item.location + "\">" + item.location + "</a></td>";
        output += "<td>" +
            "<input class=\"set_title\" data-id=\"" + item.id + "\" type=\"button\" value=\"Set Title\"/>" +
            "<input class=\"preview\" data-id=\"" + item.id + "\" type=\"button\" value=\"Preview\"/>" +
            "<input class=\"delete\" data-id=\"" + item.id + "\" type=\"button\" value=\"Delete\"/>" +
            "</td>";
        output += "</tr>";
    }

    output += "</table>";

    ctrSavedPages.innerHTML = output;
}

function updateTitle(id) {
    let entry = getPageInfo(id);

    let result = window.prompt("New title", entry.title);
    if (result !== null) {
        entry.title = result;
        chrome.storage.local.set({savedItems: savedItems}, function(){
            renderTable();
        });
    }
}

function showPreview(id) {
    document.location = '/html/preview.html#' + id;
}

function deletePage(id) {
    let entryIndex;
    for (let i = 0; i < savedItems.list.length; ++i) {
        if (savedItems.list[i].id == id) {
            entryIndex = i;
            break;
        }
    }

    let result = window.confirm("Are you sure?");
    if (result) {
        savedItems.list.splice(entryIndex, 1);
        chrome.storage.local.set({savedItems: savedItems}, function(){
            renderTable();
        });
    }
}

function selectAll() {
    let checkList = document.querySelectorAll("input.export_page");
    for (let i = 0; i < checkList.length; ++i) {
        checkList[i].checked = true;
    }
}

function exportEpub() {
    let checkList = document.querySelectorAll("input.export_page");
    let exportIdList = [];
    let exportKeyList = [];
    for (let i = 0; i < checkList.length; ++i) {
        if (checkList[i].checked) {
            exportIdList.push(checkList[i].dataset.id);
            exportKeyList.push("savedItem" + checkList[i].dataset.id);
        }
    }

    chrome.storage.local.get(exportKeyList, function (data) {
        let epubFile = new JSZip();
        epubFile.file("manifest", "application/epub+zip");

        let metaFolder = epubFile.folder("META-INF");
        metaFolder.file("container.xml", getContainerContent());

        let oebpsFolder = epubFile.folder("OEBPS");

        let contentFolder = oebpsFolder.folder("content");
        let imagesFolder = oebpsFolder.folder("images");
        let cssFolder = oebpsFolder.folder("css");

        let info = {
            id: "Test",
            title: "Test",
            date: "2016-10-28",
            chapters: [],
            images: []
        };

        for (let i = 0; i < exportIdList.length; ++i) {
            let chapterId = "chapter_" + i;
            let entryInfo = getPageInfo(exportIdList[i]);
            let entryHtml = data[exportKeyList[i]];

            let temp = document.createElement("div");
            temp.innerHTML = entryHtml;

            let imageCounter = 0;
            let doc = preparePage(temp, {
                replaceImage: function(src){
                    let imageId = "img_" + i +"_" + (imageCounter++);
                    info.images.push({
                        id: imageId,
                        file: imageId + ".png"
                    });
                    imagesFolder.file(imageId + ".png", src.substr(src.indexOf(',') + 1), {base64: true});
                    return "../images/" + imageId + ".png";
                }});

            contentFolder.file(chapterId + ".xhtml", getPageContent(entryInfo, doc));
            info.chapters.push({
                id: chapterId,
                title: entryInfo.title,
                file: chapterId + ".xhtml"
            });
        }

        oebpsFolder.file("content.opf", getEbookContent(info));
        oebpsFolder.file("navigation.ncx", getNavigationContent(info));
        contentFolder.file("toc.xhtml", getTocPageContent(info));

        epubFile.generateAsync({type: "blob"}).then(function(content){
            saveAs(content, "test.epub");
        }).catch(function(err){
            console.log(err);
        });
        console.log(data);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    ctrSavedPages = document.getElementById("saved_pages");
    ctrSelectAll = document.getElementById("select_all");
    ctrExportEpub = document.getElementById("export_epub");

    ctrSavedPages.onclick = function(data) {
        let target = data.target;

        if (target.className == "set_title") {
            updateTitle(target.dataset.id);
        } else if (target.className == "preview") {
            showPreview(target.dataset.id);
        } else if (target.className == "delete") {
            deletePage(target.dataset.id);
        }
    }

    ctrSelectAll.onclick = function() {
        selectAll();
    }

    ctrExportEpub.onclick = function() {
        exportEpub();
    }
    
    initialize();
});

