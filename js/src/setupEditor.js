var ace = require('brace');
require('brace/mode/javascript');
require('brace/theme/chrome');

module.exports = function setupEditor(name) {
        var editor = ace.edit(name);
        editor.setTheme("ace/theme/chrome");
        editor.session.setMode("ace/mode/javascript");
        editor.setOption("maxLines", 15);
        editor.setOption("minLines", 15);
        editor.setOption("highlightActiveLine", false);
        if(name === "evaluation-input") {
            editor.insert('function evaluation(input) {\n'+
            '\tinput += 1;\n'+
            '\treturn input;\n'+
            '}');
        } else if(name === "assertion-input") {
            editor.insert('function assertions(original, number, iterations) {\n'+
            '\tif(iterations > 10) return true;\n'+
            '}');
        } else {
            editor.insert('function foo() {\n'+
            '\treturn bar;\n'+
            '}');
        }
        return editor;
}

