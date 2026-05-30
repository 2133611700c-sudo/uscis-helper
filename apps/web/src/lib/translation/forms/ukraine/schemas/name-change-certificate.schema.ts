/** Name Change Certificate (Свідоцтво про зміну імені). Source: KMU No.1025 (10.11.2010). */
import type { OfficialFormSchema } from './types'
import { applyCivilContract } from './contract'
const tr=(k:string,uk:string,en:string,g:string,req=true)=>({key:k,sourceLabelUk:uk,sourceLabelEn:en,required:req,fieldGroup:g,expectedScript:'cyrillic' as const,translationRule:'transliterate_kmu55' as const,lockedEntity:true,evidenceRequired:true})
export const nameChangeCertificateSchema: OfficialFormSchema = applyCivilContract({
  docType:'ua_name_change_certificate', titleEn:'NAME CHANGE CERTIFICATE',
  officialSource:{act:'КМУ Resolution No. 1025, 10.11.2010',url:'https://zakon.rada.gov.ua/laws/show/1025-2010-%D0%BF',authority:'Cabinet of Ministers of Ukraine / Ministry of Justice',effectiveDate:'2010-11-10'},
  fields:[
    tr("previous_full_name","previous full name","Previous full name","person"),
    tr("new_full_name","new full name","New full name","person"),
    {key:'date_of_birth',sourceLabelUk:'дата народження',sourceLabelEn:'Date of birth',required:false,fieldGroup:'person',expectedScript:'mixed',translationRule:'date_normalize',lockedEntity:true,evidenceRequired:true},
    {key:'act_record_number',sourceLabelUk:'актовий запис №',sourceLabelEn:'Act record No.',required:true,fieldGroup:'actRecord',expectedScript:'numeric',translationRule:'locked_verbatim',lockedEntity:true,evidenceRequired:true},
    {key:'place_of_registration',sourceLabelUk:'місце державної реєстрації',sourceLabelEn:'Place of state registration',required:true,fieldGroup:'issuing',expectedScript:'cyrillic',translationRule:'glossary_authority',lockedEntity:false,evidenceRequired:true},
    {key:'series_number',sourceLabelUk:'Серія та номер',sourceLabelEn:'Series and No.',required:true,fieldGroup:'issuing',expectedScript:'mixed',translationRule:'locked_verbatim',lockedEntity:true,evidenceRequired:true},
  ],
  layoutSections:['header','personFields','actRecord','issuingAuthority','seals','signatures','certification'],
})
