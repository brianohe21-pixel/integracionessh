import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const sns = new SNSClient({});

export async function sendSmsTextMessage(params: {
  phoneNumber: string;
  text: string;
  originationNumber?: string;
}): Promise<{ messageId: string }> {
  const result = await sns.send(
    new PublishCommand({
      PhoneNumber: params.phoneNumber,
      Message: params.text,
      ...(params.originationNumber
        ? {
            MessageAttributes: {
              "AWS.SNS.SMS.OriginationNumber": {
                DataType: "String",
                StringValue: params.originationNumber,
              },
            },
          }
        : {}),
    })
  );
  return { messageId: result.MessageId ?? `sms-${Date.now()}` };
}
