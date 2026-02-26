/*
  Stubbed integrations to replace Base44 dependencies. These functions are not implemented.
*/
export const Core = {};
export const InvokeLLM = async () => { throw new Error('InvokeLLM stubbed'); };
export const SendEmail = async () => { throw new Error('SendEmail stubbed'); };
export const SendSMS = async () => { throw new Error('SendSMS stubbed'); };
export const UploadFile = async () => { throw new Error('UploadFile stubbed'); };
export const GenerateImage = async () => { throw new Error('GenerateImage stubbed'); };
export const ExtractDataFromUploadedFile = async () => { throw new Error('ExtractDataFromUploadedFile stubbed'); };

export default {
  Core,
  InvokeLLM,
  SendEmail,
  SendSMS,
  UploadFile,
  GenerateImage,
  ExtractDataFromUploadedFile,
};

// stub newline
