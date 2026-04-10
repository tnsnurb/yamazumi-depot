
const remarkController = require('./src/controllers/remarkController');

async function test() {
    const req = {
        params: { id: 'ТЭ33А 0001' },
        body: { template_id: 5 },
        session: {
            user: {
                id: 21,
                full_name: 'Test Admin',
                username: 'admin'
            }
        }
    };
    const res = {
        status: function(s) { 
            console.log('Status:', s); 
            return this; 
        },
        json: function(j) { 
            console.log('JSON:', JSON.stringify(j, null, 2)); 
        }
    };

    console.log('--- Starting createFromTemplate test ---');
    await remarkController.createFromTemplate(req, res);
    console.log('--- Test finished ---');
}

test();
