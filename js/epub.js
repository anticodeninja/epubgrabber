"use strict";

const KEEP_NODE = 1;
const REMOVE_NODE = 2;
const KEEP_CONTENT = 3;

const NODE_TEXT = 3;
const NODE_COMMENTS = 8;

function calcNodeAction(name) {
    if (name == "title") return REMOVE_NODE;
    if (name == "meta") return REMOVE_NODE;
    if (name == "style") return REMOVE_NODE;
    if (name == "link") return REMOVE_NODE;
    if (name == "script") return REMOVE_NODE;

    if (name == "button") return KEEP_CONTENT;
    if (name == "iframe") return REMOVE_NODE;

    if (name == "font") return KEEP_CONTENT;

    return KEEP_NODE;
}

function isValidAttr(name, attr) {
    if (attr == "id") return false;
    if (attr == "style") return false;
    if (attr == "class") return false;

    if (attr == "contenteditable") return false;
    if (attr.startsWith("data-")) return false;

    if (attr == "onclick") return false;
    if (attr == "onblur") return false;
    if (attr == "onchange") return false;
    if (attr == "onclick") return false;
    if (attr == "ondblclick") return false;
    if (attr == "onfocus") return false;
    if (attr == "onkeydown") return false;
    if (attr == "onkeypress") return false;
    if (attr == "onkeyup") return false;
    if (attr == "onload") return false;
    if (attr == "onmousedown") return false;
    if (attr == "onmousemove") return false;
    if (attr == "onmouseout") return false;
    if (attr == "onmouseover") return false;
    if (attr == "onmouseup") return false;
    if (attr == "onreset") return false;
    if (attr == "onselect") return false;
    if (attr == "onscroll") return false;
    if (attr == "onsubmit") return false;
    if (attr == "onunload") return false;

    if (name == "a") {
        if (attr != "href" && attr != "title" && attr != "rel") {
            if (attr != "name") {
                console.log("Ignored", name, attr);
            }
            return false;
        }
    } else if (name == "img") {
        if (attr != "src" && attr != "alt") {
            if (true) {
                console.log("Ignored", name, attr);
            }
            return false;
        }
    } else {
        console.log("Unhandled ", name);
    }

    return true;
}

function isContentObligatory(nodeName) {
    if (nodeName == "a") return true;
    if (nodeName == "ul") return true;
    if (nodeName == "ol") return true;

    return false;
}

function preparePage(source, params, parentContext) {
    if (source.nodeType !== 1) {
        return false;
    }

    let children = source.childNodes;
    let result = "";

    const context = {
        level: parentContext ? parentContext.level + 1 : 0,
        preserveWhitespaces: parentContext ? parentContext.preserveWhitespaces : false,
        preserveAll: parentContext ? parentContext.preserveAll : false
    };

    for (let i = 0; i < children.length; i++) {
        if (children[i].nodeType == NODE_TEXT) {
            let textContent = children[i].nodeValue;
            if (!context.preserveAll) {
                textContent = textContent.replace(/</g, '&lt;');
                textContent = textContent.replace(/>/g, '&gt;');
                textContent = textContent.replace(/&/g, '&amp;');
            }
            if (!context.preserveWhitespaces) {
                if (textContent.trim().length != 0) {
                    textContent = textContent.replace(/^[\r\n]+|[\r\n]+$/g, '');
                } else {
                    textContent = '';
                }
            }
            result += textContent;
        }
        else if (children[i].nodeType == NODE_COMMENTS) {
            // Ignore comments
        }
        else {
            let nodeName = children[i].nodeName.toLowerCase();
            let nodeAction = calcNodeAction(nodeName);

            if (nodeAction === REMOVE_NODE) {
                continue;
            }

            const content = preparePage(children[i], params, context);

            if (nodeAction === KEEP_NODE) {
                result += "<" + nodeName;
                let attributes = children[i].attributes;
                let attributesName = [];
                for (let j = 0; j < attributes.length; j++) {
                    let attrName = attributes[j].nodeName.toLowerCase();
                    let attrValue = attributes[j].nodeValue;

                    if (!isValidAttr(nodeName, attrName)) {
                        continue; // Ignore it
                    }

                    if (nodeName == "img" && attrName == "src") {
                        result += " " + attrName + "=\"" + params.replaceImage(attrValue) + "\"";
                    } else if (nodeName == "a" && attrName == "href") {
                        result += " " + attrName + "=\"" + attrValue.replace(/&/g, '&amp;') + "\"";
                    } else if (attrValue) {
                        result += " " + attrName + "=\"" + attrValue + "\"";
                    }

                    attributesName.push(attrName);
                }

                if (nodeName == "img") {
                    if (!attributesName.includes("alt")) {
                        result += " alt=\"\"";
                    }
                }

                if (content.length > 0 || isContentObligatory(nodeName)) {
                    result += ">";
                    result += content;
                    result += '</' + nodeName + '>';
                } else {
                    result += "/>";
                }
            } else if (nodeAction === KEEP_CONTENT) {
                result += content;
            }
        }
    }

    return result;
}

function getContainerContent() {
    let result = "";
    result += "<?xml version=\"1.0\" encoding=\"UTF-8\" ?>\n";
    result += "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\n";
    result += "  <rootfiles>\n";
    result += "    <rootfile full-path=\"OEBPS/content.opf\" media-type=\"application/oebps-package+xml\"/>\n";
    result += "  </rootfiles>\n";
    result += "</container>\n";
    return result;
}

function getEbookContent(info) {
    let result = "";
    result += "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n";
    result += "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"2.0\" unique-identifier=\"BookId\">\n";
    result += "<metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\"\n";
    result += "          xmlns:opf=\"http://www.idpf.org/2007/opf\">\n";
    result += "  <dc:title>" + info.title + "</dc:title>\n";
    result += "  <dc:description></dc:description>\n";
    result += "  <dc:date>" + info.date + "</dc:date>\n";
    result += "  <dc:identifier id=\"BookId\" opf:scheme=\"uid\">" + info.id + "</dc:identifier>\n";
    result += "  <dc:language>en</dc:language>\n";
    result += "  <dc:rights>Unknown</dc:rights>\n";
    result += "</metadata>\n";
    result += "<manifest>\n";
    result += "  <item id=\"navigation\" media-type=\"application/x-dtbncx+xml\" href=\"navigation.ncx\"/>\n";
    result += "  <item id=\"toc\" media-type=\"application/xhtml+xml\" href=\"content/toc.xhtml\"/>\n";
    result += "  <item id=\"css\" media-type=\"text/css\" href=\"css/ebook.css\"/>";
    for (let i = 0; i < info.chapters.length; ++i) {
        result += "  <item id=\"" + info.chapters[i].id + "\" media-type=\"application/xhtml+xml\"" +
            " href=\"content/" + info.chapters[i].file + "\"/>\n";
    }
    for (let i = 0; i < info.images.length; ++i) {
        result += "  <item id=\"" + info.images[i].id + "\" media-type=\"image/png\"" +
            " href=\"images/" + info.images[i].file + "\"/>\n";
    }
    result += "</manifest>\n";
    result += "<spine toc=\"navigation\">\n";
    result += "  <itemref idref=\"toc\"/>\n";
    for (let i = 0; i < info.chapters.length; ++i) {
        result += "  <itemref idref=\"" + info.chapters[i].id + "\"/>\n";
    }
    result += "</spine>\n";
    result += "<guide>\n";
    result += "  <reference type=\"toc\" title=\"Contents\" href=\"content/toc.xhtml\"></reference>\n";
    result += "</guide>\n";
    result += "</package>\n";
    return result;
}

function getNavigationContent(info) {
    let result = "";
    result += "<?xml version=\"1.0\"?>\n";
    result += "<!DOCTYPE ncx PUBLIC \"-//NISO//DTD ncx 2005-1//EN\"\n";
    result += "  \"http://www.daisy.org/z3986/2005/ncx-2005-1.dtd\">\n";
    result += "\n";
    result += "<ncx xmlns=\"http://www.daisy.org/z3986/2005/ncx/\" version=\"2005-1\">\n";
    result += "  <head>\n";
    result += "    <meta name=\"dtb:uid\" content=\"" + info.id + "\"/>\n";
    result += "    <meta name=\"dtb:depth\" content=\"1\"/>\n";
    result += "    <meta name=\"dtb:totalPageCount\" content=\"0\"/>\n";
    result += "    <meta name=\"dtb:maxPageNumber\" content=\"0\"/>\n";
    result += "  </head>\n";
    result += "  <docTitle>\n";
    result += "    <text>" + info.title + "</text>\n";
    result += "  </docTitle>\n";
    result += "  <navMap>\n";
    result += "    <navPoint id=\"toc\" playOrder=\"1\">\n";
    result += "      <navLabel>\n";
    result += "        <text></text>\n";
    result += "      </navLabel>\n";
    result += "      <content src=\"content/toc.xhtml\"/>\n";
    result += "    </navPoint>\n";
    for (let i = 0; i < info.chapters.length; ++i) {
        result += "    <navPoint id=\"" + info.chapters[i].id + "\" playOrder=\"" + (2 + i) + "\">\n";
        result += "      <navLabel>\n";
        result += "        <text>" + info.chapters[i].title + "</text>\n";
        result += "      </navLabel>\n";
        result += "      <content src=\"content/" + info.chapters[i].file + "\"/>\n";
        result += "    </navPoint>\n";
    }
    result += "  </navMap>\n";
    result += "</ncx>\n";
    return result;
}

function getTocPageContent(info) {
    let result = "";
    result += "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n";
    result += "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.1//EN\"";
    result += "                      \"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd\">\n";
    result += "<html xmlns=\"http://www.w3.org/1999/xhtml\">\n";
    result += "  <head>\n";
    result += "    <title>Table of Contents</title>\n";
    result += "    <link rel=\"stylesheet\" type=\"text/css\" href=\"../css/ebook.css\"/>";
    result += "  </head>\n";
    result += "  <body>\n";
    result += "    <h2>Table of Contents</h2>\n";
    result += "    <ol class=\"toc-items\">\n";
    for (let i = 0; i < info.chapters.length; ++i) {
        result += "      <li><a href=\"" + info.chapters[i].file + "\">" + info.chapters[i].title + "</a></li>\n";
    }
    result += "    </ol>\n";
    result += "  </body>\n";
    result += "</html>\n";
    return result;
}

function getPageContent(info, payload) {
    let result = "";
    result += "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n";
    result += "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.1//EN\"";
    result += "                      \"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd\">\n";
    result += "<html xmlns=\"http://www.w3.org/1999/xhtml\">\n";
    result += "  <head profile=\"http://dublincore.org/documents/dcmi-terms/\">\n";
    result += "    <meta http-equiv=\"Content-Type\" content=\"text/html;\" />\n";
    result += "    <title>" + info.title + "</title>\n";
    result += "    <link rel=\"stylesheet\" type=\"text/css\" href=\"../css/ebook.css\"/>";
    result += "    <meta name=\"DCTERMS.title\" content=\"" + info.title + "\" />\n";
    result += "    <meta name=\"DCTERMS.language\" content=\"en\" scheme=\"DCTERMS.RFC4646\" />\n";
    result += "    <link rel=\"schema.DC\" href=\"http://purl.org/dc/elements/1.1/\" hreflang=\"en\" />\n";
    result += "    <link rel=\"schema.DCTERMS\" href=\"http://purl.org/dc/terms/\" hreflang=\"en\" />\n";
    result += "    <link rel=\"schema.DCTYPE\" href=\"http://purl.org/dc/dcmitype/\" hreflang=\"en\" />\n";
    result += "    <link rel=\"schema.DCAM\" href=\"http://purl.org/dc/dcam/\" hreflang=\"en\" />\n";
    result += "  </head>\n";
    result += "  <body>\n";

    payload = payload.split("\n");
    for (let i = 0; i < payload.length; ++i) {
	let line = payload[i].trim();
	if (line.length > 0) {
	    result += "    " + line + "\n";
	}
    }

    result += "  </body>\n";
    result += "</html>\n";

    return result;
}

function getCssContent() {
    let result = "";

    result += "body {\n";
    result += "  font-size: medium;\n";
    result += "}\n";

    result += "img {\n";
    result += "  max-width: 100%\n";
    result += "}\n";

    result += "code, pre {\n";
    result += "  white-space: pre-wrap;\n";
    result += "  font-size: 75%;\n";
    result += "}\n";

    return result;
}
