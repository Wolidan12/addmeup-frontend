import {withTimeout} from '../lib/errors.js'

// Owner-confirmed destination. Never silently substitute another beneficiary or
// display these constants as though a failed database read had succeeded.
export const approvedDepositBank={bank_name:'MONIEPOINT',account_number:'6977298247',account_name:'LUNA ENTRY SERVICES - DANQEL SOCIAL BOOST'}
export async function loadDepositBank(client){
 const {data,error}=await withTimeout(client.from('bank_transfer_details').select('bank_name,account_number,account_name').eq('id',true).single())
 if(error)throw error
 if(!data||Object.keys(approvedDepositBank).some(k=>String(data[k]??'').trim().toUpperCase()!==approvedDepositBank[k]))throw new Error('Deposit beneficiary requires owner review')
 return data
}
