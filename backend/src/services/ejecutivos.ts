export const ejecutivosPorCliente: Record<string, string> = {
  'ACTIVA BI': 'Julieta Salvucci',
  'AMX Argentina S.A.': 'Leonardo Nocera',
  'AON RISK SERVICES ARGENTINA SA': 'Joaquin Ramirez',
  'ARTE RADIOTELEVISIVO ARGENTINO S.A': 'Julieta Salvucci',
  'BOEHRINGER INGELHEIM ANIMAL HEALTH SA': 'Emiliano Angelinetta',
  'BUREAU VERITAS ARGENTINA S.A': 'Joaquin Ramirez',
  'Banco Cetelem Argentina SA': 'Julieta Salvucci',
  'Boehringer Ingelheim S.A.': 'Emiliano Angelinetta',
  'CRESUD SACIFYA': 'Julieta Salvucci',
  'DGO ARGENTINA S.R.L.': 'Joaquin Ramirez',
  'DIRECTV ARGENTINA SOCIEDAD ANONIMA': 'Joaquin Ramirez',
  'EMPRENDIMIENTO LA LUISINA S.R.L.': 'Joaquin Ramirez',
  'ENIT BSAS S.R.L.': 'Joaquin Ramirez',
  'EXPERTA ART S.A': 'Joaquin Ramirez',
  'EXPERTUR S R L': 'Julieta Salvucci',
  'Edenred Argentina S.A.': 'Leonardo Nocera',
  'Irsa Inversiones y Respresentaciones S.A': 'Julieta Salvucci',
  'Iservice S.R.L.': 'Joaquin Ramirez',
  'It Maker S.A': 'Agustin Fazio',
  'LOGICO S.A': 'Joaquin Ramirez',
  'Latenergy SA': 'Joaquin Ramirez',
  'MICRO SISTEMAS S.A.U.': 'Leonardo Nocera',
  'Medife Asociacion Civil': 'Emiliano Angelinetta',
  'O.S. DEL PERSONAL DE DIRECCIÓN ASE': 'Emiliano Angelinetta',
  'ORBITH SA': 'Leonardo Nocera',
  'OVERLABS TECHNOLOGY S.A': 'Joaquin Ramirez',
  'PHARMEXX ARGENTINA S.A.': 'Joaquin Ramirez',
  'PLUSQUIMICA S.A.': 'Joaquin Ramirez',
  'Red Link SA': 'Emiliano Angelinetta',
  'SCANIA ARGENTINA SAU': 'Julieta Salvucci',
  'Sanofi Aventis Argentina S.A.': 'Julieta Salvucci',
  'Siderca S.A.I.C': 'Maria Fernanda Dugini',
  'Swiss Medical Group': 'Emiliano Angelinetta',
  'TECHINT COMPAÑIA TECNICA INTERNACIONAL': 'Maria Fernanda Dugini',
  'TERNIUM ARGENTINA S.A.': 'Maria Fernanda Dugini',
  'Toyota Compañia Financiera de Arg SA': 'Leonardo Nocera',
  'Zapviz Studio SRL': 'Joaquin Ramirez',
  // Compatibilidad con búsquedas parciales
  'AON': 'Joaquin Ramirez',
  'Artear': 'Julieta Salvucci',
  'Bayer Monsanto': 'Leonardo Nocera',
  'Boehringer': 'Emiliano Angelinetta',
  'Cetelem': 'Julieta Salvucci',
  'Devactiva': 'Julieta Salvucci',
  'DirecTV': 'Joaquin Ramirez',
  'Equifax España': 'Maria Cadarso',
  'Experta': 'Joaquin Ramirez',
  'IRSA': 'Julieta Salvucci',
  'La Caja': 'Leonardo Nocera',
  'Lógico SA': 'Joaquin Ramirez',
  'Medifé': 'Emiliano Angelinetta',
  'NoFraud': 'Fernanda Dugini',
  'Orbith': 'Leonardo Nocera',
  'Overlabs': 'Joaquin Ramirez',
  'PILOT': 'Julieta Salvucci',
  'Red Link S.A.': 'Emiliano Angelinetta',
  'Road To Data': 'Maria Cadarso',
  'Salesforce': 'Pablo Cruz',
  'Scania': 'Julieta Salvucci',
  'Spotlio': 'Maria Cadarso',
  'StoneX': 'Julieta Salvucci',
  'Techint': 'Fernanda Dugini',
  'Telecom': 'Leonardo Nocera',
  'Tenaris': 'Fernanda Dugini',
  'Ternium': 'Fernanda Dugini',
  'ToolBox': 'Julieta Salvucci',
  'Toyota': 'Leonardo Nocera',
  'Usina de Innovación': 'Pablo Cruz',
  'AEROBOX S.A.': 'Joaquin Ramirez',
  'Caja de Seguros S.A': 'Julieta Salvucci',
  'Enjoy Selling SA': 'Joaquin Ramirez'
}

const normalizar = (valor: string) =>
  valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

export function getEjecutivo(nombreCliente: string): string {
  if (ejecutivosPorCliente[nombreCliente]) return ejecutivosPorCliente[nombreCliente]

  const clienteNormalizado = normalizar(nombreCliente)
  const key = Object.keys(ejecutivosPorCliente).find(k => {
    const candidato = normalizar(k)
    return clienteNormalizado.includes(candidato) || candidato.includes(clienteNormalizado)
  })

  return key ? ejecutivosPorCliente[key] : 'Sin asignar'
}
