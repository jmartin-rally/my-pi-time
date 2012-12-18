// model for the grid
Ext.define('summaryModel', {
    extend: 'Ext.data.Model',
    fields: [
	{ name: 'FormattedID', type: 'string' },
    { name: 'Name', type: 'string' },
    { name: 'ObjectID', type: 'string'}, 
    { name: 'Sunday', type: 'float', defaultValue: 0 },
    { name: 'Monday', type: 'float', defaultValue: 0 },
    { name: 'Tuesday', type: 'float', defaultValue: 0 },
    { name: 'Wednesday', type: 'float', defaultValue: 0 },
    { name: 'Thursday', type: 'float', defaultValue: 0 },
    { name: 'Friday', type: 'float', defaultValue: 0 },
    { name: 'Saturday', type: 'float', defaultValue: 0 },
    { name: 'Total', type: 'float', defaultValue: 0 }
    ]
});
        
