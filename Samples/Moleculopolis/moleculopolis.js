'use strict';

// Wrap everything in an anonymous function to avoid poluting the global namespace
(function () {
  let unregisterHandlerFunctions = [];

  $(document).ready(function () {
    tableau.extensions.initializeAsync().then(function () {
      fetchFilters();

      // Add button handlers for clearing filters.
      $('#clear').click(clearAllFilters);
    }, function (err) {
      // Something went wrong in initialization.
      console.log('Error while Initializing: ' + err.toString());
    });
  });

  function fetchFilters () {
    // While performing async task, show loading message to user.
    $('#loading').addClass('show');

    // Whenever we reste the filters table, remove all save handling functions,
    // since we add them back later in this function.
    unregisterHandlerFunctions.forEach(function (unregisterHandlerFunction) {
      unregisterHandlerFunction();
    });

    // Since filter info is attached to the worksheet, we will perform
    // one async call per worksheet to get every filter used in this
    // dashboard.  This demonstrates the use of Promise.all to combine
    // promises together and wait for each of them to resolve.
    let filterFetchPromises = [];

    // List of all filters in a dashboard.
    let dashboardfilters = [];

    // To get filter info, first get the dashboard.
    const dashboard = tableau.extensions.dashboardContent.dashboard;

    // Then loop through each worksheet and get its filters, save promise for later.
    dashboard.worksheets.forEach(function (worksheet) {
      filterFetchPromises.push(worksheet.getFiltersAsync());

      // Add filter event to each worksheet.  AddEventListener returns a function that will
      // remove the event listener when called.
      let unregisterHandlerFunction = worksheet.addEventListener(tableau.TableauEventType.FilterChanged, filterChangedHandler);
      unregisterHandlerFunctions.push(unregisterHandlerFunction);
    });

    // Now, we call every filter fetch promise, and wait for all the results
    // to finish before displaying the results to the user.
    Promise.all(filterFetchPromises).then(function (fetchResults) {
      fetchResults.forEach(function (filtersForWorksheet) {
        filtersForWorksheet.forEach(function (filter) {
          dashboardfilters.push(filter);
        });
      });

      buildFiltersTable(dashboardfilters);
    });
  }

  // This is a handling function that is called anytime a filter is changed in Tableau.
  function filterChangedHandler (filterEvent) {
    // Just reconstruct the filters table whenever a filter changes.
    // This could be optimized to add/remove only the different filters.
    fetchFilters();
  }

  // Contructs UI that displays all the dataSources in this dashboard
  // given a mapping from dataSourceId to dataSource objects.
  function buildFiltersTable (filters) {
    // Clear the table first.
    $('#filtersTable > tbody tr').remove();
    const filtersTable = $('#filtersTable > tbody')[0];

    filters.forEach(function (filter) {
      let newRow = filtersTable.insertRow(filtersTable.rows.length);
      let nameCell = newRow.insertCell(0);
      let worksheetCell = newRow.insertCell(1);
      let typeCell = newRow.insertCell(2);
      let valuesCell = newRow.insertCell(3);

      const valueStr = getFilterValues(filter);

      nameCell.innerHTML = filter.fieldName;
      worksheetCell.innerHTML = filter.worksheetName;
      typeCell.innerHTML = filter.filterType;
      valuesCell.innerHTML = valueStr;
    });

    updateUIState(Object.keys(filters).length > 0);
  }

  // This returns a string representation of the values a filter is set to.
  // Depending on the type of filter, this string will take a different form.
  function getFilterValues (filter) {
    let filterValues = '';

    switch (filter.filterType) {
      case 'categorical':
        filter.appliedValues.forEach(function (value) {
          filterValues += value.formattedValue + ', ';
        });
        break;
      case 'range':
        // A range filter can have a min and/or a max.
        if (filter.minValue) {
          filterValues += 'min: ' + filter.minValue.formattedValue + ', ';
        }

        if (filter.maxValue) {
          filterValues += 'min: ' + filter.maxValue.formattedValue + ', ';
        }
        break;
      case 'relative-date':
        filterValues += 'Period: ' + filter.periodType + ', ';
        filterValues += 'RangeN: ' + filter.rangeN + ', ';
        filterValues += 'Range Type: ' + filter.rangeType + ', ';
        break;
      default:
    }

    // Cut off the trailing ", "
    return filterValues.slice(0, -2);
  }

  // This function removes all filters from a dashboard.
  function clearAllFilters () {
    // While performing async task, show loading message to user.
    $('#loading').removeClass('hidden').addClass('show');
    $('#filtersTable').removeClass('show').addClass('hidden');

    const dashboard = tableau.extensions.dashboardContent.dashboard;

    dashboard.worksheets.forEach(function (worksheet) {
      worksheet.getFiltersAsync().then(function (filtersForWorksheet) {
        let filterClearPromises = [];

        filtersForWorksheet.forEach(function (filter) {
          filterClearPromises.push(worksheet.clearFilterAsync(filter.fieldName));
        });

        // Same pattern as in fetchFilters, wait until all promises have finished
        // before updating the UI state.
        Promise.all(filterClearPromises).then(function () {
          updateUIState(false);
        });
      });
    });
  }

  // This helper updates the UI depending on whether or not there are filters
  // that exist in the dashboard.  Accepts a boolean.
  function updateUIState (filtersExist) {
    $('#loading').addClass('hidden');
    if (filtersExist) {
      $('#filtersTable').removeClass('hidden').addClass('show');
      $('#noFiltersWarning').removeClass('show').addClass('hidden');
    } else {
      $('#noFiltersWarning').removeClass('hidden').addClass('show');
      $('#filtersTable').removeClass('show').addClass('hidden');
    }
  }
})();


// -------------------------------------------------------------------------
// 
//

// SAMPLE code pulled from codepen
// Setup to load data from rawgit
/* NGL.DatasourceRegistry.add(
  "data", new NGL.StaticDatasource( "//cdn.rawgit.com/arose/ngl/v0.10.0-dev.20/data/" )
);

// Create NGL Stage object
var stage = new NGL.Stage( "viewport" );

// Handle window resizing
window.addEventListener( "resize", function( event ){
  stage.handleResize();
}, false );


// Code for example: showcase/viruses

function addElement( el ){
  Object.assign( el.style, {
      position: "absolute",
      zIndex: 10
  } );
  stage.viewer.container.appendChild( el );
}

function createElement( name, properties, style ){
  var el = document.createElement( name );
  Object.assign( el, properties );
  Object.assign( el.style, style );
  return el;
}

var pdbs = [ "1stm", "3nap", "1sid", "2ft1", "4cwu" ];
var colors = [ "red", "yellow", "green", "lightblue", "violet" ];

Promise.all( pdbs.map( function( id ){
  return stage.loadFile( "rcsb://" + id )
} ) ).then( function( ol ){

  ol[ 1 ].setPosition( [ -169.65, -178.95, -90.31 ] );

  ol.map( function( o, i ){
      o.setVisibility( false );
      o.addRepresentation( "surface", {
          assembly: "BU1",
          color: colors[ i ],
          scaleFactor: 0.15,
          surfaceType: "sas"
      } );
  } );

  var userInput = false;

  stage.tasks.onZeroOnce( function(){
    stage.autoView();
    var clipNear = 20;
    var delta = 1;
    var intervalId = setInterval( function(){
        if( userInput ){
            clearInterval( intervalId );
            return;
        }
        stage.setParameters( { clipNear: clipNear } );
        clipRange.value = clipNear;
        clipNear += delta;
        if( clipNear >= 75 ){
            delta *= -1;
        }
        if( clipNear <= 50 && delta < 0 ){
            clearInterval( intervalId );
        }
    }, 100 );
    setTimeout( function(){
        ol.map( function( o ){
            o.setVisibility( true );
        } );
    }, 10 );
  } );

  var clipRange = createElement( "input", {
    type: "range",
    value: 20,
    min: 0,
    max: 100,
    step: 1
  }, { top: "1em", left: "1em" } );

  clipRange.oninput = function( e ){
      userInput = true;
      stage.setParameters( { clipNear: e.target.value } );
  };

  addElement( clipRange );

} );
 */