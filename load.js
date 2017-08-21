var asdf = require("d3"); // dummy call for vscode
var dataCSV, dataNested; // keep data global
var thumbnails, abstracts; // set the big things last
var dayNames = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
var dayAbrevs = {"Tuesday morning": "Tu AM", "Tuesday afternoon": "Tu PM", 
                 "Wednesday morning": "W AM", "Wednesday afternoon": "W PM", 
                 "Thursday morning": "Th AM", "Thursday afternoon": "Th PM", 
                 "Friday morning": "F AM", "Friday afternoon": "F PM"};
var journals = {"TVCG": "Transactions on Visualization and Computer Graphics", "C&GA": "Computer Graphics and Applications", "VAST": "Proceedings of IEEE VAST 2016"};
var OADomains = ["osf.io", "arxiv.org", "biorxiv.org", "psyarxiv.org", "hal.inria.fr", "hal.archives-ouvertes.fr", "eprints.whiterose.ac.uk"];
var linkImages = {"PDF": "file-text", "Material": "materials", "Data": "data", "Explanation": "info"};
var timeParser = d3.timeParse("%H:%M %p");
var style = "col-md-12 col-lg-10 col-lg-offset-1";
var untouched = true;


// load and parse the data
d3.csv("openaccessvis.csv", d => d, function(error, data) {
  if (error) throw error;
  dataCSV = data;
  
  dataCSV = dataCSV.map(d => { d.PM = timeParser(d.ConferenceTimeStart).getHours() > 12; return d; });
  console.log(dataCSV);

  // nest the data
  dataNested = d3.nest()
    // day
    .key(d => (dayNames.indexOf(d.ConferenceDay) + (+d.PM * 0.5)) + "|" + d.ConferenceDay + " " + (d.PM ? "afternoon" : "morning"))
    .sortKeys((a,b) => a.split("|")[0] - b.split("|")[0])
    // session
    .key(d => d.ConferenceTrack + "|" + d.ConferenceSession)
    .entries(dataCSV);
  console.log(dataNested);
  dataNested = dataNested.map(d => {
      // sort papers within each session
      d.values = d.values.map(s => {
          s.values.sort( (a,b) => timeParser(a.ConferenceTimeStart) - timeParser(b.ConferenceTimeStart));
          s.startTime = s.values[0].ConferenceTimeStart;
          return s;
      });
      // sort sessions
      d.values.sort( (a,b) => timeParser(a.startTime) - timeParser(b.startTime) )
      return d;
  });

  buildPage();
});

// use the data to construct the page elements
function buildPage() {
  ///// Day /////
  var days = d3.select(".container")
    .selectAll(".day")
    .data(dataNested).enter();
  days = days.append("div")
    .classed("day", true)
    .classed("row", true)
    .attr("id", d => d.key.split("|")[1].replace(" ", "_"))
    .append("div")
        .classed(style, true);
  
  days.append("h2")
    .text(d => d.key.split("|")[1]);

  makeDayButtons();
  
  ///// session /////
  var sessions = days.selectAll(".session")
    .data(d => d.values).enter()
    .append("div")
        .attr("class", d => d.values[0].ConferenceTrack.toLowerCase())
        .classed("session", true);
  sessions.append("h3").text(d => d.values[0].ConferenceSession);

  ///// paper /////
  var papers = sessions.selectAll(".paper")
    .data(s => s.values).enter()
    .append("div")
        .attr("id", getSimpleName)
        .attr("class", "paper row")
        .classed("closedAccess", d => d.AuthorPDF == "");
  
  ///// thumbnail /////
  var left = papers.append("div")
    .classed("col-sm-3 col-sm-2 hidden-xs thumbExpander", true);
  left.append("img")
    .classed("spacer", true)
    .attr("src", "images/blank.png");

  ///// expander button  /////
  var expander = left.append("div").classed("thumbExpanderContainer", true);
  thumbnails = expander.append("div").classed("thumbContainer", true).append("img")
    .classed("thumb", true)
    .attr("src", "images/Closed_Access_Research.svg");
  expander.append("img").classed("expander", true).attr("src", "images/chevron-circle-down.svg");
  left.on("click", (d,i) => expandEventHandler(left, d));

  ///// basic info /////
  var mid = papers.append("div")
    .classed("col-sm-8 col-xs-12", true);
  mid.append("p")
        .classed("title", true)
        .text(d => d.Title);
  mid.append("p")
        .classed("authors", true)
        .text(d => d.Authors);
  mid.append("p")
        .classed("time", true)
        .text(d => d.ConferenceTimeStart + " - " + d.ConferenceTimeEnd + " " + d.ConferenceDay);
  mid.append("p")
        .classed("closedAccessMessage", true)
        .html("This paper does not appear to be available. Please encourage the authors to post their work.");

  ///// links /////
  var right = papers.append("div")
    .classed("col-sm-2 col-xs-12 links", true);
  var mobileThumbnails = right.append("img").classed("thumb", true);
  right.appendLink("PDF", "PDF", d => d.AuthorPDF);
  right.appendLink("sourceMaterial", "Material", d => d.SourceMaterials);
  right.appendLink("data", "Data", d => d.Data);
  right.appendLink("projectPage", "Explanation", d => d.ExplanationPage);


  ///// expander content  /////
  var expandInfo = papers.append("div")
    .attr("id", d => getSimpleName(d) + "_expandInfo")
    .classed("col-sm-8 col-xs-12 expandInfo collapse", true);
  abstracts = expandInfo.append("p")
    .classed("abstract", true);
  expandInfo.append("pre")
    .classed("citation", true)
    .text(makeCitation);

  // load thumbnails last
  thumbnails.attr("src", getThumbnailPath);
  mobileThumbnails.attr("src", getThumbnailPath);
} // end buildPage()



// make a simple name for the paper
function getSimpleName(paper, sep = "_") {
  var title = dropLeadingArticle(paper.Title);
  return title.split(/[^\w]/, 1)[0].toLowerCase()
         + sep
         + paper.Authors.split(/[^\w]/, 1)[0].toLowerCase();
}
function dropLeadingArticle (text) {
  if (text.startsWith("A ")) text = text.substring(2);
  if (text.startsWith("An ")) text = text.substring(3);
  if (text.startsWith("The ")) text = text.substring(4);
  return text;
}

// get thumbnail image
function getThumbnailPath(paper) {
  if (paper.AuthorPDF == "")
    return "images/Closed_Access_Research.svg";
  return "thumbnails/" + getSimpleName(paper, "-") + ".png";
}

// is the pdf on a true open access repository
function isOpenAccessDomain(href) {
  for (var i = 0; i < OADomains.length; i++) {
     if (href.includes(OADomains[i])) 
      return true;
  }
  return false;
}

// add a link and icon
d3.selection.prototype.appendLink = function (css, text, href) {
  var link = this.append("a")
    .classed("link " + css, true)
    .attr("target", "_blank")
    .attr("href", href)
    .attr("title", d => isOpenAccessDomain(href(d)) ? "Open access repository with permanent URL" : "Personal/Institutional site")
    .classed("OADomain", d => isOpenAccessDomain(href(d)));

  link.append("img")
    .attr("src", d => 
      "images/" +
      linkImages[text] + 
      (isOpenAccessDomain(href(d)) ? ".svg" : "-o.svg"));

  link.append("span")
    .text(text);
}

// make text that can be copied for a citation
function makeCitation(paper) {
  var APA = "";
  var authors = paper.Authors.split(", ");
  APA = authors[0];
  if (authors.length == 2)
    APA += " and " + authors[1];
  if (authors.length > 2) {
    for (var a = 1; a < authors.length - 1; a++)
      APA += ", " + authors[a];
    APA += ", and " + authors[authors.length - 1];
  }
  APA += ". \"" + paper.Title + "\". ";
  APA += journals[paper.PublicationVenue] + ". ";
  APA += paper.PublicationYear + ". ";
  APA += paper.DOI ? "DOI:" + paper.DOI + "." : "";

  var bibtex = "@Article{" + getSimpleName(paper) + ",\n";
  bibtex += "  author = " + paper.Authors.split(", ").join(" and ") + "\n";
  bibtex += "  title = " + paper.Title + "\n";
  bibtex += "  journal = " + journals[paper.PublicationVenue] + "\n";
  bibtex += "  year = " + paper.PublicationYear + "\n";
  bibtex += "  DOI = " + paper.DOI + "\n";
  bibtex += "}";

  return APA + "\n\n" + bibtex;
}

// show/hide the expand region
function expandEventHandler(left, paper) {
  if (untouched)
    abstracts.html(d => d.Abstract);
  if (paper.AuthorPDF == "") 
    return;
  left.classed("isExpanded", !left.classed("isExpanded"));
  var id = getSimpleName(paper) + "_expandInfo";
  $('#' + id).collapse('toggle');
}

// make button to show/hide each day
function makeDayButtons() {
  d3.select("#dayToggles")
    .selectAll("button")
    .data(dataNested).enter()
    .append("button")
      .attr("type", "button")
      .classed("btn active btn-day", true)
      .attr("data-toggle", "button") 
      .attr("data-subset", d => "#" + d.key.split("|")[1].replace(" ", "_"))
      .attr("aria-pressed", "true")
      .attr("autocomplete", "off")
      .append("span").text(d => dayAbrevs[d.key.split("|")[1]]);
  
  // set up button events handlers
  d3.selectAll('button').on("click", function() {
    var subset = d3.select(this).node().dataset["subset"];
    var isPressed = d3.select(this).attr("aria-pressed");
    console.log(subset);
    console.log(isPressed);
    d3.selectAll(subset).style("display", isPressed == "false" ? "block" : "none");
  });
}

// just for dev
function checkImageSizes() {
  d3.selectAll(".thumb").each(function(d) {
    var a = d3.select(this).node();
    if (a.naturalHeight > a.naturalWidth * .75)
    console.log(a.src);
  });
}