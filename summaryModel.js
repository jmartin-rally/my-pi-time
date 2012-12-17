// model for the grid
Ext.define('summaryModel', {
    extend: 'Ext.data.Model',
    fields: [
	{ name: 'FormattedID', type: 'string' },
    { name: 'Name', type: 'string' },
    { name: 'ObjectID', type: 'string'}, 
    { name: 'Total', type: 'float', defaultValue: 0 }
    ]
});
        
