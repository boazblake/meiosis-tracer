/*global process*/
var fs = require("fs")
var fromDir = process.argv[2]
var toDir = process.argv[3]

var linkMap = {
  "flyd": "https://unpkg.com/flyd@0.2.8/flyd.js",
  "meiosis-tracer": "https://unpkg.com/meiosis-tracer@2.0.0/dist/meiosis-tracer.js",
  "mithril": "https://unpkg.com/mithril@1.1.6",
  "mithril-stream": "https://unpkg.com/mithril-stream@1.1.0",
  "react": "https://unpkg.com/react@16.4.2/umd/react.development.js",
  "react-dom": "https://unpkg.com/react-dom@16.4.2/umd/react-dom.development.js",
  "rxjs": "https://unpkg.com/@reactivex/rxjs@6.2.2/dist/global/rxjs.umd.js"
}

var filenames = fs.readdirSync(fromDir)

filenames.forEach(source => {
  var input = fs.readFileSync(fromDir + "/" + source, "ascii")
  var lines = input.split("\n")
  var flemNumber = 1

  lines = lines.map(function(line) {
    if (line.startsWith("@flems")) {
      var parts = line.split(" ")

      var files = parts[1].split(",")
      var fileContents = files.map(longfilename => {
        var filename = null
        var shortname = null
        var asIndex = longfilename.indexOf("#as#")
        if (asIndex >= 0) {
          filename = longfilename.substring(0, asIndex)
          shortname = longfilename.substring(asIndex + 4)
        }
        else {
          filename = longfilename
          shortname = longfilename.substring(longfilename.lastIndexOf("/") + 1)
        }
        var file = JSON.stringify(fs.readFileSync(filename, "ascii"))
        var compiler = ""
        if (shortname.endsWith("jsx")) {
          shortname = shortname.substring(0, shortname.length - 1)
        }
        if (shortname.endsWith("js")) {
          compiler = ", compiler: \"babel\""
        }
        return `{name: "${shortname}", content: ${file}${compiler}}`
      })
      var fileString = "[" + fileContents.join(",") + "]"

      var links = parts.length > 2 ? parts[2].split(",") : []
      if (links.length === 1 && links[0] === "[]") {
        links = []
      }
      var linkContents = links.map(link => {
        var url = linkMap[link]
        return `{name: "${link}", type: "js", url: "${url}"}`
      })
      var linkString = "[" + linkContents.join(",") + "]"

      var style = ""
      var autoHeight = "autoHeight: true,"
      if (parts.length > 3) {
        style = " style=\"height:" + parts[3] + "px\""
        autoHeight = ""
      }
      var middle = "60"
      if (parts.length > 4) {
        middle = parts[4]
      }

      line = `
  <div id="flems${flemNumber}" class="flemscode"${style}></div>

  <script>
    window.Flems(flems${flemNumber}, {
      files: ${fileString},
      links: ${linkString},
      middle: ${middle},
      autoFocus: false,
      ${autoHeight}
      selected: 'index.js'
    })
  </script>
      `

      flemNumber++
    }
    return line
  })

  var dest = toDir + "/" + source
  fs.writeFileSync(dest, lines.join("\n"))
})
