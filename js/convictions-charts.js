(function(window, document, d3, Convictions) {
  window.Convictions = Convictions;

  var charts = Convictions.charts = Convictions.charts || {};

  /**
   * Wrap svg text to an element.
   *
   * This function is by Mike Bostock, from http://bl.ocks.org/mbostock/7555321
   */
  function wrapText(text, width) {
    text.each(function() {
      var text = d3.select(this),
        words = text.text().split(/\s+/).reverse(),
        word,
        line = [],
        lineNumber = 0,
        lineHeight = 1.1, // ems
        y = text.attr("y"),
        dy = parseFloat(text.attr("dy")),
        tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
      while (word = words.pop()) {
        line.push(word);
        tspan.text(line.join(" "));
        if (tspan.node().getComputedTextLength() > width) {
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
        }
      }
    });
  }

  /**
   * https://gist.github.com/mathewbyrne/1280286
   */
  function slugify(text) {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  }


  /**
    Factory to generate a reusable bar chart.

    @returns A function that can be called on a d3 selection to add
       an SVG element containing a chart.

    The returned function should be applied to a d3 selection using the
    call() method.  For example:

    var chart = barChart(); 
    var selection = d3.select('#chart-container')
      .datum(data)
      .call(chart);

    It expects the bound data to be objects with 'label' and 'value'
    properties.

    The returned function has the following getters/setters that can be used
    to configure the chart.

    * margin
    * aspectRatio
    * renderTooltip
    * width
    * height
    * renderBar
    * x
    * y
    * xScale
    * yScale
    * tooltipLabel
    * tooltipValue
   
    References:
    * http://bost.ocks.org/mike/bar/3/
    * http://bost.ocks.org/mike/chart/
    * http://blog.apps.npr.org/2014/05/19/responsive-charts.html
  */
  function barChart() {
    // Configuration variables

    // Public
    // These can be get/set with accessors defined below
    var svg;
    var margin = {top: 20, right: 30, bottom: 30, left: 60};
    var aspectRatio = 16 / 9; // Width to height
    var renderTooltip; // Function to render tooltip
    // Internal width and height of the chart
    var width;
    var height;
    var renderBar;
    var x; // Scale for x axis 
    var y; // Scale for y axis 
    var xScale;
    var yScale;
    var tooltipLabel = function(d) {
      return d.label;
    };
    var tooltipValue = function(d) {
      return d.value;
    };
    var postRender = function(selection) {};
    // Element for bars added.  This needs to be a parameter
    // because stacked bar charts will use a ``g`` element
    // instead of the default rect.
    var barElement = 'rect';
    var bindMouseEvents = function(selection, svg) {
      var tooltip = null;
      selection 
          .on('mouseover', function(d, i) {
            tooltip = svg.append('g')
                .datum(d)
                .attr('class', tooltipClass)
                .call(renderTooltip)
                .call(positionTooltip);
          })
          .on('mousemove', function(d, i) {
            if (tooltip !== null) {
              tooltip.call(positionTooltip);
            }
          })
          .on('mouseout', function(d, i) {
            if (tooltip !== null) {
              tooltip.remove();
            }
            tooltip = null;
          });
    };

    // Private

    // Class that will be set on popup elements 
    var tooltipClass = 'tooltip-chart'; 
    // Distance from the pointer to where the tooltip is rendered
    var tooltipOffset = 4; 
    // Margins of the popup element
    var tooltipMargin = {top: 4, right: 4, bottom: 4, left: 4};

    /**
     * Position a popup relative to mouse position.
     *
     * @param selection - d3 selection for an SVG group element for
     *   the tooltip.
     *   
     */
    function positionTooltip(selection) {
      // This should get the DOM Node for the inner chart element
      var container = selection.node().parentNode;
      // We reference the global height and width variables rather than
      // getting height and width using container.getBBox() because the
      // calculated width and height change as we add our popup element.
      var containerWidth = width;
      var containerHeight = height;
      var position = d3.mouse(container);
      var bbox = selection.node().getBBox();
      var x = position[0];
      var y = position[1];

      // Generally, the tooltip should be positioned below and to the right
      // of the mouse pointer.  However, if this results in the element 
      // falling outside of the chart boundary we need to position it above
      // or to the left of the mouse.
      if (x + bbox.width > containerWidth) {
        x -= (tooltipOffset + bbox.width);
      }
      else {
        x += tooltipOffset;
      }

      if (y + bbox.height > containerHeight) {
        y -= (tooltipOffset + bbox.height);
      }
      else {
        y += tooltipOffset;
      }

      selection.attr('transform', 'translate(' + x + ',' + y + ')');
    }

    /**
     * Populate a popup element.
     */
    function defaultRenderTooltip(selection) {
      var border = selection.append('rect');
      var text = selection.append('text')
          .attr('text-anchor', 'start')
          .attr('x', tooltipMargin.left)
          .attr('y', tooltipMargin.top)
          .attr('dy', '0.75em');
      var margin = tooltipMargin;
      var bbox;

      text.append('tspan')
          .attr('class', 'label')
          .attr('x', tooltipMargin.left)
          .text(function(d) { return tooltipLabel(d); });

      text.append('tspan')
          .attr('class', 'value')
          .attr('x', tooltipMargin.left)
          .attr('dy', '1.5em')
          .text(function(d) { return tooltipValue(d); });

      bbox = text.node().getBBox();

      border.attr('width', bbox.width + margin.left + margin.right)
          .attr('height', bbox.height + margin.top + margin.bottom);
    }

    // Set the default tooltip rendering function.  This can be overridden
    // with the setter below.
    renderTooltip = defaultRenderTooltip;

    function defaultRenderBar(selection) {
      selection.attr('x', function(d) { return x(d.label); })
        .attr('y', function(d) { return y(d.value); })
        .attr('height', function(d) { return height - y(d.value); })
        .attr('width', x.rangeBand())
        .attr('fill', 'steelblue');
    }

    renderBar = defaultRenderBar;

    function defaultXScale(data) {
      return d3.scale.ordinal()
        .domain(data.map(function(d) { return d.label; }))
        .rangeRoundBands([0, width], 0.1);
    }

    xScale = defaultXScale;

    function defaultYScale(data) {
      return d3.scale.linear()
        .domain([0, d3.max(data, function(d) { return d.value; })])
        .range([height, 0]);
    }

    yScale = defaultYScale;

    function chart(selection) {
      selection.each(function(data, i) {
        var containerWidth = parseInt(d3.select(this).style('width'), 10);
        width = containerWidth - margin.left - margin.right;
        height = Math.ceil(width * (1 / aspectRatio)) - margin.top - margin.bottom;
        x = xScale(data); 
        y = yScale(data); 
        var xAxis = d3.svg.axis()
            .scale(x);
        var yAxis = d3.svg.axis()
            .scale(y)
            .orient('left');
        svg = d3.select(this).append('svg')
            .attr('class', 'chart-bar')
            .attr("width", containerWidth)
            .attr("height", height + margin.top + margin.bottom)
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        var bar = svg.selectAll(".bar")
            .data(data)
          .enter().append(barElement)
            .attr('class', function(d) { return 'bar ' + slugify(d.label); })
            .call(renderBar)
            .call(bindMouseEvents, svg);

        svg.append('g')
            .attr('class', 'x axis')
            .attr('transform', 'translate(0,' + height + ')')
            .call(xAxis);

        svg.append('g')
          .attr('class', 'y axis')
          .call(yAxis);

        svg.call(postRender);
      });
    }

    // Getters/setters for public configuration properties
   
    // This property is read-only
    chart.svg = function() {
      return svg;
    };

    chart.margin = function(_) {
      if (!arguments.length) return margin;
      margin = _;
      return chart;
    };

    chart.aspectRatio = function(_) {
      if (!arguments.length) return aspectRatio;
      aspectRatio = _;
      return chart;
    };

    chart.renderTooltip = function(_) {
      if (!arguments.length) return renderTooltip;
      renderTooltip = _;
      return chart;
    };

    chart.x = function(_) {
      if (!arguments.length) return x;
      x = _;
      return chart;
    };

    chart.y = function(_) {
      if (!arguments.length) return y;
      y = _;
      return chart;
    };

    chart.xScale = function(_) {
      if (!arguments.length) return xScale;
      xScale = _;
      return chart;
    };

    chart.yScale = function(_) {
      if (!arguments.length) return yScale;
      yScale = _;
      return chart;
    };

    chart.width = function(_) {
      if (!arguments.length) return width;
      width = _;
      return chart;
    };

    chart.height = function(_) {
      if (!arguments.length) return height;
      height = _;
      return chart;
    };

    chart.renderBar = function(_) {
      if (!arguments.length) return renderBar;
      renderBar = _;
      return chart;
    };

    chart.tooltipLabel = function(_) {
      if (!arguments.length) return tooltipLabel;
      tooltipLabel = _;
      return chart;
    };

    chart.tooltipValue = function(_) {
      if (!arguments.length) return tooltipValue;
      tooltipValue = _;
      return chart;
    };

    chart.postRender = function(_) {
      if (!arguments.length) return postRender;
      postRender = _;
      return chart;
    };

    chart.barElement = function(_) {
      if (!arguments.length) return barElement;
      barElement = _;
      return chart;
    };

    chart.bindMouseEvents = function(_) {
      if (!arguments.length) return bindMouseEvents;
      bindMouseEvents = _;
      return chart;
    };

    return chart;
  }

  function horizontalBarChart() {
    var chart = barChart()
      .margin({
        top: 20,
        right: 0,
        bottom: 30,
        left: 150
      })
      .xScale(function(data) {
        return d3.scale.linear()
          .domain([0, d3.max(data, function(d) { return d.value; })])
          .range([0, chart.width()]);
      })
      .yScale(function(data) {
        return d3.scale.ordinal()
          .domain(data.map(function(d) { return d.label; }))
          .rangeRoundBands([chart.height(), 0], 0.1);
      })
      .renderBar(function(selection) {
        selection.attr('x', 0)
          .attr('y', function(d) { return chart.y()(d.label); })
          .attr('height', function(d) { return chart.y().rangeBand(); })
          .attr('width', function(d) { return chart.x()(d.value); });
      })
      .postRender(function(selection) {
        selection.selectAll('.tick text')
            .call(wrapText, chart.margin().left - 20)
            .attr('y', -(chart.y().rangeBand() / 2))
          .selectAll('.tick text tspan')
            .attr('dx', '-1em');
      });

    return chart;
  }

  /**
   * Render a stacked horizontal bar chart
   *
   * Each row of data should be an object.
   *
   * Each row of data should have a property ``label`` which
   * will be used for the label of the row.
   *
   * The values of each property of the object should also be
   * objects with a ``label`` and ``value`` property.
   *
   * The row needs to contain a property named 'total' whose
   * value represents the total of all other columns.
   */
  function stackedHorizontalBarChart() {
    // The columns in our data.  Each of these will be a segment
    // in the stacked bar.
    var segmentKeys;
    var colorVals;
    var color = d3.scale.ordinal();

    // Extract the columns (which represent one region of the stack)
    // as an array.
    // This is needed to go from each row being an object and
    // also to filter out the special columns in the data.
    // Add starting and finishing x coordinates
    function getValueCols(d) {
      var cols = [];
      var x0 = 0;

      segmentKeys.forEach(function(key) {
        if (d[key]) {
          d[key].x0 = x0;
          d[key].x1 = x0 += +d[key].value;

          cols.push(d[key]);
        }  
      });
      return cols;
    }

    var chart = horizontalBarChart();
    // Save the original mouse event binding function.  We
    // want to bind the events to the bar segments rather than
    // the group elements.
    var defaultMouseEvents = chart.bindMouseEvents();

    chart
      .barElement('g')
      .xScale(function(data) {
        return d3.scale.linear()
          .domain([0, d3.max(data, function(d) { return d.total.value; })])
          .range([0, chart.width()]);
      })
      // Don't bind mouse events on the outer container,
      // instead, we'll bind them to the bar segments
      // later.
      .bindMouseEvents(function(selection, svg) {})
      .renderBar(function(selection) {
        color
          .domain(segmentKeys)
          .range(colorVals);

        selection
          .attr("transform", function(d) { return "translate(0," + chart.y()(d.label) + ")"; });

        selection.selectAll('rect')
            .data(getValueCols)
          .enter().append('rect')
            .attr('class', function(d) { return 'bar-segment ' + slugify(d.label); })
            .attr('x', function(d) { return chart.x()(d.x0); })
            .attr('y', function(d) { return chart.y()(d.label); })
            .attr('height', function(d) { return chart.y().rangeBand(); })
            .attr('width', function(d) { return chart.x()(d.value); })
            .attr('fill', function(d) { 
              return color(d.key); 
             })
            // Bind mouse events to the bar segments
            .call(defaultMouseEvents, chart.svg());
      });

    // Getters/setters for public configuration properties
   
    chart.segmentKeys = function(_) {
      if (!arguments.length) return segmentKeys;
      segmentKeys = _;
      return chart;
    };

    chart.colorVals = function(_) {
      if (!arguments.length) return colorVals;
      colorVals = _;
      return chart;
    };

    return chart;
  }

  function createCategoryChart(el, data) {
    var chart = barChart();

    d3.select(el)
      .datum(data)
      .call(chart);
  }

  function createDrugChart(el, data) {
    var total = d3.sum(data, function(d) {
      return d.value;
    });
    var pctData = data.map(function(d) {
      return {
        label: d.label,
        value: (d.value / total) * 100
      };
    });
    var formatValue = d3.format(",.1%");
    var chart = horizontalBarChart()
      .tooltipValue(function(d) {
        return formatValue(d.value / 100);
      });
    d3.select(el)
      .datum(pctData)
      .call(chart);
  }

  function createDrugChargeClassChart(el, data, segmentKeys, colorVals) {
    var chart = stackedHorizontalBarChart()
      .segmentKeys(segmentKeys)
      .colorVals(colorVals);

    // Add total column to the rows
    data.forEach(function(d) {
      var total = {
        label: "Total",
        value: 0
      }; 
      segmentKeys.forEach(function(key) {
        // Not every row will have all of the segments
        if (d[key]) {
          d[key].key = key;
          total.value += d[key].value;
        }
      });
      d.total = total;
    });

    d3.select(el)
      .datum(data)
      .call(chart);
  }

  function ageRangeLabel(d) {
    var label = "";

    if (d.invalid_ages) {
      return "Unknown Age";
    }

    if (d.age_min) {
      label += d.age_min;
      if (d.age_max) {
        label += " - ";
      }
    }
    else {
      label += "<";
    }

    if (d.age_max) {
      label += d.age_max; 
    }
    else {
      label += "+";
    }
 
    return label;
  }

  function createAgeChart(el, data) {
    var xformedData = data.sort(function(a, b) {
      if (a.invalid_ages) {
        return 1;
      }
      else if (b.invalid_ages) {
        return -1;
      }
      else if (a.age_min < b.age_min) {
        return -1;
      }
      else if (a.age_min == b.age_min) {
        return 1;
      }
      else {
        return 1;
      }
    })
    .map(function(d) {
      return {
        value: d.total_convictions,
        label: ageRangeLabel(d)
      };
    });
    var chart = horizontalBarChart();

    d3.select(el)
      .datum(xformedData)
      .call(chart);
  }

  charts.barChart = barChart;
  charts.horizontalBarChart = horizontalBarChart;
  Convictions.createCategoryChart = createCategoryChart;
  Convictions.createDrugChargeClassChart = createDrugChargeClassChart;
  Convictions.createDrugChart = createDrugChart;
  Convictions.createAgeChart = createAgeChart;
})(window, document, d3, window.Convictions || {});
