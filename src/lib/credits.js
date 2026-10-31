export const formatDC=value=>new Intl.NumberFormat('en-NG',{maximumFractionDigits:2}).format(Number(value||0))+' DC'
export const dcDisclosure='DC are virtual platform credits, not cash, bank deposits or automatically withdrawable money. ₦1 = 1 DC. Connections are free.'
