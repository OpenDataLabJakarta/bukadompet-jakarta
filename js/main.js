// namespace
var COS = { 
  columns : [
    { 
      name: "nama_skpd", 
      type: "string" 
    },
    { 
      name: "nama_urusan", 
      type: "string" 
    },
    { 
      name: "nama_program", 
      type: "string" 
    },
    { 
      name: "nilai_anggaran", 
      type: "number" 
    },
    { 
      name: "nilai_spj", 
      type: "number" 
    }
  ],
  
  // container for our application views
  Views : {},

  // application router
  Router : Backbone.Router.extend({

    routes : {
      "" : "index"
    },

    index : function() {  
      // configuration parameters that are used throughout the application:
      COS.config = {
        // Define which columns the data can be grouped by
        groupings : [
          {
            label: "Sektor Anggaran",
            column: "nama_urusan"
          },
          {
            label: "Besar Alokasi per SKPD",
            column: "nama_skpd"
          }
        ],

        // Define the maximum number of groups to be included in the chart at any time
        maxGroups : 20,

        categoryColors : [
          "#CF3D1E", "#F15623", "#F68B1F", "#FFC60B", "#DFCE21",
          "#BCD631", "#95C93D", "#48B85C", "#00833D", "#00B48D", 
          "#60C4B1", "#27C4F4", "#478DCB", "#3E67B1", "#4251A3", "#59449B", 
          "#6E3F7C", "#6A246D", "#8A4873", "#EB0080", "#EF58A0", "#C05A89"
         ]
      };

      // state management 
      COS.state = {
        // Store the name of the column by which the data is currently grouped.
        currentGrouping : COS.config.groupings[0].column
      };

      // Define the underlying dataset for this interactive treemap.
      COS.data = new Miso.Dataset({
        url: "data/2015-rapbd-jakarta.summary.csv",
        delimiter: ",",
        columns: COS.columns
      });

      
      COS.data.fetch({
        success : function() {
          COS.app = new COS.Views.Main();
          COS.app.render();
        },

        error: function(){
          COS.app.views.title.update("Gagal memuat data dari lokasi " + data.url);
        }
      });

    }
  })
};

/**
* Main application view
*/
COS.Views.Main = Backbone.View.extend({

  initialize : function() {
    this.views = {};
  },

  render : function() {
    this.views.title = new COS.Views.Title();
    this.views.grouping = new COS.Views.Grouping();
    this.views.treemap = new COS.Views.Treemap();

    this.views.title.render();
    this.views.grouping.render();
    this.views.treemap.render();
  } 
});

COS.Views.Title = Backbone.View.extend({

  el : "#legend",
  initialize : function(options) {
    options = options || {};
    this.defaultMessage = "Rancangan Anggaran Belanja Pemprov DKI Jakarta 2015";
    this.message = options.message || this.defaultMessage;
    this.setElement($(this.el));
  },
  render : function() {
    this.$el.html(this.message);
  },
  update : function(message) {
    if (typeof message !== "undefined") {
      this.message = message;
    } else {
      this.message = this.defaultMessage;
    }
    this.render();
  }

});

/**
* Represents a dropdown box with a list of grouping options.
*/
COS.Views.Grouping = Backbone.View.extend({

  el       : "#groupby",
  template : 'script#grouping',
  events   : {
    "change" : "onChange"
  },

  initialize : function(options) {
    options        = options || {};
    this.groupings = options.groupings || COS.config.groupings;
    this.template  = _.template($(this.template).html());
    this.setElement($(this.el));
  },

  render : function () {
    this.$el.parent().show();
    this.$el.html(this.template({ columns : this.groupings }));
    console.log(this);
    return this;
  },

  // Whenever the dropdown option changes, re-render
  // the chart.
  onChange : function(e) {
    COS.state.currentGrouping = $("option:selected", e.target).val();
    COS.app.views.treemap.render();
  }

});

/**
* A tree map, uses d3.
*/
COS.Views.Treemap = Backbone.View.extend({

  el : "#chart", 

  initialize : function(options) {
    options = options || {};
    this.width = options.width || 970;
    this.height = options.height || 600;
    this.setElement($(this.el));
  },

  _hideGroup : function(elType, fadeTime, offset) {
    if (fadeTime) {
      offset = offset || 0;
      $(elType).each(function(index){
        $(this).delay(offset*index).fadeOut(fadeTime);
      });
    } else {
      $(elType).hide();
    }
  },

  _showGroup : function(elType, fadeTime, offset) {
    if (fadeTime) {
      offset = offset || 0;
      $(elType).each(function(index){
        $(this).delay(offset*index).fadeIn(fadeTime);
      });
    } else {
      $(elType).show();
    }
  },

  render : function() {

    // load state
    var grouping  = COS.state.currentGrouping,
      maxGroups = COS.config.maxGroups;

    // Create a data subset that we are rendering
    var groupedData = COS.Utils.computeGroupedData();

    // === build data for d3
    var expenseData = { 
      name: grouping, 
      elements: [] 
    };

    groupedData.each(function(row, index){
      if (index >= maxGroups) {
        return;
      }
      expenseData.elements.push({ 
        name:  row[grouping], 
        total: row["nilai_anggaran"], 
        color: COS.config.categoryColors[index % COS.config.categoryColors.length] 
      });
    });

    // === build d3 chart
    // Build a treemap chart with the supplied data (using D3 to create, size, color and layout a series of DOM elements).
    // Add labels to each cell, applying dynamic styling choices according to the space available.
    // Bind custom handlers to cell highlighting and selection events.    
    this.$el.empty();
    var selected = null;

    var layout = d3.layout.treemap()
      .sort(function(a,b){ 
          return a.value - b.value; 
        })
      .children(function(d){ 
        return d.elements; 
      })
      .size([this.width, this.height])
      .value(function(d){ 
        return d.total; 
      });

    var chart = d3.select("#chart")
      .append("div")

      // set default styles for chart
      .call(function(){
        this.attr("class", "chart")
          .style("position", "relative")
          .style("width", this.width + "px")
          .style("height", this.height + "px");
        }
      );

    // set up data for the chart
    chart.data([expenseData])
      .selectAll("div")
      .data(function(d){
        return layout.nodes(d);
      })
      .enter()
        .append("div")

        // append a div for every piece of the treemap
        .call(function(){
          this.attr("class", "cell")
            .style("left",       function(d){ return d.x + "px"; })
            .style("top",        function(d){ return d.y + "px"; })
            .style("width",      function(d){ return d.dx - 1 + "px"; })
            .style("height",     function(d){ return d.dy - 1 + "px"; })
          .style("background", function(d){ return d.color || "#f7f7f7"; });
        })

        // on click just output some logging
        .on("click", function(d){
          if (selected) { 
            selected.toggleClass("selection") 
          }; 
          selected = $(this);
          selected.toggleClass("selection"); 
          console.log(d, selected);
        })
        
        // on mouseover, fade all cells except the one being
        // selected.
        .on("mouseover", function(d){
          
          // update Title.
          COS.app.views.title.update(
            COS.Utils.toTitleCase(d.name) + " - " + 
            COS.Utils.toMoney(d.value.toFixed(0))
          );

          $(".cell").stop().fadeTo(300, 0.2); 
          $(this).stop().fadeTo(0, 1.0);
        })

        // on mouse out, unfade all cells.
        .on("mouseout", function(d) {
          $(".cell").stop().fadeTo("fast", 1.0);
          COS.app.views.title.update();
        })
        .append("p")
        // set the size for the labels for the dollar amount.
        // vary size based on size.
        .call(function(){
          this.attr("class", "label")
              .style("font-size", function(d) {
                return d.area > 55000 ? 
                  "13px" : 
                  d.area > 20000 ? 
                    "12px" : 
                    d.area > 13000 ? 
                      "10px" : 
                      "0px"; 
              })
              .style("text-transform", "uppercase");
          })

          // append dollar amounts
          .html(function(d){
            return "<span class='cost'>" + 
                COS.Utils.toMoney(d.value.toFixed(0)) + 
              "</span>" + 
              COS.Utils.toTitleCase(d.name); 
          });

    // some graceful animation
    this._hideGroup("#chart .cell");  
    this._showGroup("#chart .cell", 300, 10);
  }
});

// Random Utility functions
COS.Utils = {
  // Return the string supplied with its first character converted to upper case
  toTitleCase : function(str) {
    return str.charAt(0).toUpperCase() + str.substr(1);
  },

  // Format currency values for display using the required prefix and separator 
  toMoney : function(amount) {
    options = {
      symbol : "Rp",
      decimal : ",",
      thousand: ".",
      precision : 0
    };
    // we are using the accounting library
    return accounting.formatMoney(amount, options);
  },

  // Compute grouped data for a specific range, by the grouping.
  computeGroupedData : function() {
    // load state
    var grouping  = COS.state.currentGrouping,
      maxGroups = COS.config.maxGroups;

    var groupedData = COS.data.rows('').groupBy(grouping, ["nilai_anggaran"]);
    groupedData.sort({
      comparator : function(a ,b){ 
        if (b["nilai_anggaran"] > a["nilai_anggaran"]) { return  1; }
        if (b["nilai_anggaran"] < a["nilai_anggaran"]) { return -1; }
        if (b["nilai_anggaran"] === a["nilai_anggaran"]) { return 0; }
      }      
    });
    return groupedData;
  }
};

// Kick off application.
var mainRoute = new COS.Router();
Backbone.history.start();
