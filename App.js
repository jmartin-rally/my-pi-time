/*global console, Ext */
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items: [ 
             { xtype: 'container', itemId: 'table_box', padding: 5 }
             ],
    launch: function() {
        //Write app code here
        this.TotalByWorkProductID = { "None": 0 };
        this.TotalByParentID = { "None": 0 };
        this.ThemeName = "Theme";

    	this._setWeekFilter( new Date() );
        this._getTime();
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
    },
    /*
     * When we have total by top-level parent totals and the names of the themes,
     * only keep the totals for things that are under themes (or mark as "None")
     */
    _makeSummaryGrid: function(pi_data) {
        for ( var parentID in this.TotalByParentID ) {
            if ( this.TotalByParentID.hasOwnProperty(parentID) ) {
                if ( pi_data[ parentID ] ) {
                    pi_data[ parentID ].Total += this.TotalByParentID[parentID];
                } else {
                    pi_data.None.Total += this.TotalByParentID[parentID];
                }
            }
        }
        var store = Ext.create( 'Rally.data.custom.Store', {
            model: 'summaryModel',
            data: this._hashToArray(pi_data)
        });
        
        var grid = Ext.create( 'Rally.ui.grid.Grid', {
            store: store,
            columnCfgs: [ 
            { text: 'Theme', dataIndex: 'Name' },
            { text: 'Total', dataIndex: 'Total' }
            ]
        });
        
        this.down('#table_box').add(grid);
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
                        that.TotalByParentID[parentID] += that.TotalByWorkProductID[myID];
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
        var time_store = Ext.create( 'Rally.data.WsapiDataStore', {
            autoLoad: true,
            model: 'TimeEntryItem',
            filters: this.week_filter,
            fetch: ['WorkProduct','ObjectID','Values','Project','Name','DateVal','Hours', 'Task'],
            listeners: {
                load: function( store, data, success ) {
                    //console.log( data );
                    that.TotalByWorkProductID = { "None": 0 };
                    Ext.Array.each( data, function(datum) {
                        var time_line = datum.data;
                        var wp = "None";
                        if ( time_line.WorkProduct ) {
                            wp = time_line.WorkProduct.ObjectID ;
                        }
                        Ext.Array.each( time_line.Values, function(value) {
                            if ( !that.TotalByWorkProductID[wp] ) {
                                that.TotalByWorkProductID[wp] = 0;
                            }
                            that.TotalByWorkProductID[wp] += value.Hours;
                        });
                    });
                    that._getTreeFromLookback();
                },
                scope: this
            }
        });
        
    }
});
