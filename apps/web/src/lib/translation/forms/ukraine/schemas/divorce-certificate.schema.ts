/** Divorce Certificate (Свідоцтво про розірвання шлюбу). Source: KMU No.1025 (10.11.2010). */
import type { OfficialFormSchema } from './types'
import { applyCivilContract } from './contract'
const tr = (k:string,uk:string,en:string,g:string,req=true)=>({key:k,sourceLabelUk:uk,sourceLabelEn:en,required:req,fieldGroup:g,expectedScript:'cyrillic' as const,translationRule:'transliterate_kmu55' as const,lockedEntity:true,evidenceRequired:true})
export const divorceCertificateSchema: OfficialFormSchema = applyCivilContract({
  docType:'ua_divorce_certificate', titleEn:'CERTIFICATE OF DISSOLUTION OF MARRIAGE',
  officialSource:{act:'КМУ Resolution No. 1025, 10.11.2010',url:'https://zakon.rada.gov.ua/laws/show/1025-2010-%D0%BF',authority:'Cabinet of Ministers of Ukraine / Ministry of Justice',effectiveDate:'2010-11-10'},
  fields:[
    tr('groom_full_name','чоловік','Husband (full name)','groom'),
    tr('bride_full_name','дружина','Wife (full name)','bride'),
    {key:'date_of_dissolution',sourceLabelUk:'розірвано',sourceLabelEn:'Date of dissolution',required:true,fieldGroup:'dissolution',expectedScript:'mixed',translationRule:'date_normalize',lockedEntity:true,evidenceRequired:true},
    tr('groom_surname_after','прізвище йому','Husband surname after','dissolution',false),
    tr('bride_surname_after','прізвище їй','Wife surname after','dissolution',false),
    {key:'act_record_number',sourceLabelUk:'актовий запис №',sourceLabelEn:'Act record No.',required:true,fieldGroup:'actRecord',expectedScript:'numeric',translationRule:'locked_verbatim',lockedEntity:true,evidenceRequired:true},
    {key:'place_of_registration',sourceLabelUk:'місце державної реєстрації',sourceLabelEn:'Place of state registration',required:true,fieldGroup:'issuing',expectedScript:'cyrillic',translationRule:'glossary_authority',lockedEntity:false,evidenceRequired:true},
    {key:'series_number',sourceLabelUk:'Серія та номер',sourceLabelEn:'Series and No.',required:true,fieldGroup:'issuing',expectedScript:'mixed',translationRule:'locked_verbatim',lockedEntity:true,evidenceRequired:true},
  ],
  layoutSections:['header','personFields','actRecord','issuingAuthority','seals','signatures','certification'],
})
