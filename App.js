/*global console, Ext */
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items: [ 
            { xtype: 'container', itemId: 'selector_box', padding: 5, layout: { type: 'hbox' }, items: [
		        { xtype: 'container', itemId: 'week_box', padding: 5 },
		        { xtype: 'container', itemId: 'print_box', padding: 5 }
               ]},
             { xtype: 'container', itemId: 'table_box', padding: 5 }
             ],
    launch: function() {
        //Write app code here
        this.ThemeName = "Theme";
       
    	this._setWeekFilter( new Date() );
        this._addWeekSelector();
        this._addPrintButton();
        this._getTime();
       
    },
    _addWeekSelector: function() {
        var date_selector = Ext.create('Rally.ui.DateField',{
            fieldLabel: 'Week of',
            value: this._setWeekFilter(new Date()),
            listeners: {
                change: function( cal, newValue, oldValue, opts ) {
                    var adjustedValue = this._setWeekFilter(newValue);
                    // to prevent double getting
                    if ( newValue.setMilliseconds(0) == adjustedValue.setMilliseconds(0) ) {
                        this._getTime();
                    } else {
                        cal.setValue( adjustedValue );
                    }
                },
                scope: this
            }
        });
        this.down('#week_box').add(date_selector);
    },
    _setWeekFilter: function( date_inside_the_week ) {
    	var begin = Rally.util.DateTime.add( date_inside_the_week, "day", -7);
    	var begin_iso = Rally.util.DateTime.toIsoString( begin, false );
        var end_iso = Rally.util.DateTime.toIsoString( date_inside_the_week, false );
        
        this.week_filter = [ 
            { property: 'WeekStartDate', operator: '>', value: begin_iso },
            { property: 'WeekStartDate', operator: '<', value: end_iso },
            { property: 'User', operator: '=', value: this.getContext().getUser()._ref }
        ];
        
        display_begin = Rally.util.DateTime.add( date_inside_the_week, "day", -1 * ( date_inside_the_week.getDay()))
        return display_begin;
    },
    _addPrintButton: function() {
        var button = Ext.create( 'Rally.ui.Button', {
            text:'Print',
            listeners: {
                click: {
                    fn: function() { this._print('table_box'); },
                    scope: this
                }
            }
        } );
        this.down('#print_box').add(button);
    },
    _print: function( element_name ) {
        var printElement = this.down('#'+element_name);
        var printWindow = window.open('','', 'width=200,height=100');
        printWindow.document.write( '<html><head>');
        printWindow.document.write('<title>Print PI Time</title>');
        printWindow.document.write('<link rel="Stylesheet" type="text/css" href="/apps/2.0p5/rui/resources/css/rui.css" />');
        
        printWindow.document.write('</head><body>');
        printWindow.document.write(printElement.el.dom.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.print();
    },
    /*
     * When we have total by top-level parent totals and the names of the themes,
     * only keep the totals for things that are under themes (or mark as "None")
     */
    _makeSummaryGrid: function(pi_data) {
        if ( this.summary_grid ) { this.summary_grid.destroy(); }
        for ( var parentID in this.TotalByParentID ) {
            if ( this.TotalByParentID.hasOwnProperty(parentID) ) {
                if ( pi_data[ parentID ] ) {
                    pi_data[ parentID ] = this._mergeDayValues( pi_data[parentID], this.TotalByParentID[parentID] );
                } else {
                    pi_data.None = this._mergeDayValues( pi_data.None, this.TotalByParentID[parentID] );
                }
            }
        }
        console.log("pi data", pi_data );
        var store = Ext.create( 'Rally.data.custom.Store', {
            model: 'summaryModel',
            data: this._hashToArray(pi_data)
        });
        
        this.summary_grid = Ext.create( 'Rally.ui.grid.Grid', {
            store: store,
            showPagingToolbar: false,
            columnCfgs: [ 
            { text: 'Theme', dataIndex: 'Name' },
            { text: 'Sunday', dataIndex: 'Sunday' },
            { text: 'Monday', dataIndex: 'Monday' },
            { text: 'Tuesday', dataIndex: 'Tuesday' },
            { text: 'Wednesday', dataIndex: 'Wednesday' },
            { text: 'Thursday', dataIndex: 'Thursday' },
            { text: 'Friday', dataIndex: 'Friday' },
            { text: 'Saturday', dataIndex: 'Saturday' },
            { text: 'Total', dataIndex: 'Total' }
            ]
        });
        
        this.down('#table_box').add(this.summary_grid);
    },
    _hashToArray: function(hash) {
        var theArray = [];
        for ( var i in hash ) {
            if ( hash.hasOwnProperty(i) ) {
                theArray.push(hash[i]);
            }
        }
        return theArray;
    },
    /* 
     * Have to see what top-level items are themes
     */
    _getAssociatedThemes: function() {
        var that = this;
        var filters = null;
        for ( var parentID in this.TotalByParentID ) {
            if ( this.TotalByParentID.hasOwnProperty(parentID) && parentID != "None" ) {
                if ( filters ) {
                    filters = filters.or(Ext.create('Rally.data.QueryFilter', 
                        { property: 'ObjectID', operator: '=', value: parentID }));
                } else {
                    filters = Ext.create('Rally.data.QueryFilter', 
                        { property: 'ObjectID', operator: '=', value: parentID });
                }
            }
        }
        var pi_data = { "None": { "Name": "No Theme", "FormattedID": "", "Total": 0, "ObjectID": "None" } };
        Ext.create('Rally.data.WsapiDataStore', {
		    model: 'PortfolioItem',
            filters: filters,
            autoLoad: true,
		    listeners: {
		        load: function(store, data, success) {
		            //process data
                    Ext.Array.each( data, function( pi_record ) {
                        var pi = pi_record.data;
                        if ( pi.PortfolioItemTypeName === that.ThemeName ) {
                            pi_data[ pi.ObjectID ] = { "Name": pi.Name, "FormattedID": pi.FormattedID, "Total": 0, "ObjectID": pi.ObjectID};
                        } 
                    });
                    that._makeSummaryGrid(pi_data);
		        }
		    },
		    fetch: ['Name', 'FormattedID', 'PortfolioItemType', 'PortfolioItemTypeName']
		});
    },
    /*
     * After we get all the times, we go look up the times' workproducts using
     * lookback to find the top-level parent (so we can consolidate)
     */
    _getTreeFromLookback: function() {
        console.log( "totals so far", this.TotalByWorkProductID );
        var that = this;
        var filters = null;
        for ( var itemID in this.TotalByWorkProductID ) {
            if ( this.TotalByWorkProductID.hasOwnProperty(itemID) && itemID != "None") {
                if ( filters ) {
                    filters = filters.or ( Ext.create('Rally.data.lookback.QueryFilter', {
					    property: '_ItemHierarchy',
					    operator: '=',
					    value: parseInt( itemID, 10 )
					}));
                } else {
                    filters = Ext.create('Rally.data.lookback.QueryFilter', {
                        property: '_ItemHierarchy',
                        operator: '=',
                        value: parseInt( itemID, 10 )
                    });
                }
            }
        }
        
        if ( filters ) {
            filters = filters.and( Ext.create('Rally.data.lookback.QueryFilter', {
				                        property: '__At',
				                        operator: '=',
				                        value: 'current'
				                    }));  

	        var lb_store = Ext.create('Rally.data.lookback.SnapshotStore', {
	            autoLoad: true,
	            fetch: [ '_ItemHierarchy' ],
	            filters: filters,
	            listeners: {
	                load: function( store, data, success ) {
                        that.TotalByParentID = { };
	                    that._setTotalByParent( data );
	                }
	            }
	        });
        } else {
            console.log( "data problem");
        }
        
    },
    /*
     * Given the top-level item for each workproduct, add up the times
     * for that top-level parent (not yet checking to make sure it's a PI
     */
    _setTotalByParent: function( data ) {
        var that = this;
        this.TotalByParentID = { "None": 0 };
        Ext.Array.each( data, function(datum) {
            var snapshot = datum.data;
            if ( snapshot._ItemHierarchy && snapshot._ItemHierarchy.length > 0 ) {
                var parentID = snapshot._ItemHierarchy[0];
                var myID = snapshot.ObjectID;
                if ( that.TotalByWorkProductID[myID] ) {
                    if ( that.TotalByParentID[parentID] ) {
                        that.TotalByParentID[parentID] = that._mergeDayValues( that.TotalByParentID[parentID], that.TotalByWorkProductID[myID] );
                    } else {
                        that.TotalByParentID[parentID] = that.TotalByWorkProductID[myID]; 
                    }
                }
            }
        });
        that.TotalByParentID.None = that.TotalByWorkProductID.None;
        console.log( "Total By Highest Parent I know about:", that.TotalByParentID );
        this._getAssociatedThemes();
    },
    /*
     * Go get the time from the week hit by the filter
     * 
     */
    _getTime: function() {
        var that = this;
        this.TotalByParentID = { };
        if ( this.summary_grid ) { this.summary_grid.destroy(); }
        var time_store = Ext.create( 'Rally.data.WsapiDataStore', {
            autoLoad: true,
            model: 'TimeEntryItem',
            filters: this.week_filter,
            fetch: ['WorkProduct','ObjectID','Values','Project','Name','DateVal','Hours', 'Task'],
            listeners: {
                load: function( store, data, success ) {
                    //console.log( data );
                    that.TotalByWorkProductID = { };
                    Ext.Array.each( data, function(datum) {
                        var time_line = datum.data;
                        var wp = "None";
                        if ( time_line.WorkProduct ) {
                            wp = time_line.WorkProduct.ObjectID ;
                        }
                        that._addDayValues( wp, time_line.Values );
                    });
                    that._getTreeFromLookback();
                },
                scope: this
            }
        });
    },
    _mergeDayValues: function( aHash, bHash ) {
        var totalHash = aHash;
        for ( var day in bHash ) {
            if ( aHash.hasOwnProperty(day) && bHash.hasOwnProperty(day) ) {
                totalHash[day] = aHash[day] + bHash[day];
            } else if ( bHash.hasOwnProperty(day) ) {
                totalHash[day] = bHash[day];
            }
        }
        return totalHash;
    },
    _addDayValues: function( wp, entries ) {
        var that = this;
        days = [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ];
        Ext.Array.each( entries, function(entry){
            if ( ! that.TotalByWorkProductID[wp] ) {
                that.TotalByWorkProductID[wp] = {
                    Sunday: 0,
                    Monday: 0,
                    Tuesday: 0,
                    Wednesday: 0,
                    Thursday: 0,
                    Friday: 0,
                    Saturday: 0,
                    Total: 0
                }
            }
            var day_of_week = Rally.util.DateTime.fromIsoString( entry.DateVal ).getUTCDay();
            var day_of_week_name = days[day_of_week];
            console.log( entry.DateVal , day_of_week, day_of_week_name );
            that.TotalByWorkProductID[wp][day_of_week_name] += entry.Hours;
            that.TotalByWorkProductID[wp].Total += entry.Hours;
        });
    }
});
