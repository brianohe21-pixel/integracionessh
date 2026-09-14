export type TermsSection = {
  title: string;
  paragraphs?: string[];
  listItems?: string[];
  listAfterParagraphs?: number;
};

export type TermsContent = {
  pageTitle: string;
  sections: TermsSection[];
};

export const termsContentEs: TermsContent = {
  pageTitle: "Términos y condiciones",
  sections: [
    {
      title: "1. Introducción y aceptación",
      paragraphs: [
        'Los presentes Términos y Condiciones (en adelante, los "Términos") regulan el acceso y uso del sitio web integracionessh.lat, de la plataforma Agent Platform y de los servicios ofrecidos por Integraciones SH (en adelante, "Integraciones SH", "nosotros" o "el Prestador").',
        "Al acceder al sitio, crear una cuenta, contratar un plan o utilizar Agent Platform, el Usuario declara haber leído, comprendido y aceptado íntegramente estos Términos. Si no está de acuerdo, debe abstenerse de utilizar el sitio y los servicios.",
        "Estos Términos se interpretan conforme a la legislación de la República de Colombia, incluyendo el Código de Comercio, el Código Civil, la Ley 527 de 1999 sobre comercio electrónico y mensajes de datos, la Ley 1480 de 2011 (Estatuto del Consumidor), la Ley 1581 de 2012 y sus decretos reglamentarios, y las demás normas aplicables según la naturaleza de la relación contractual.",
      ],
    },
    {
      title: "2. Identificación del prestador",
      paragraphs: [
        "El servicio es prestado por Integraciones SH, con domicilio en Colombia y canales de atención disponibles a través de:",
      ],
      listItems: [
        "Sitio web: integracionessh.lat",
        "Correo electrónico: info@integracionessh.lat",
        "WhatsApp: +57 321-7455642",
      ],
    },
    {
      title: "3. Definiciones",
      listItems: [
        "Usuario: Persona natural o jurídica que accede al sitio o utiliza los servicios, con o sin cuenta registrada.",
        "Cliente: Usuario que contrata un plan de pago o celebra un acuerdo comercial con Integraciones SH.",
        "Plataforma o Agent Platform: Software como servicio (SaaS) para gestión de agentes de IA, comunicación omnicanal, automatización, inbox, campañas, citas, cobros y API.",
        "Contenido del Usuario: Datos, mensajes, configuraciones, flujos, contactos y demás información que el Cliente o sus usuarios autorizados carguen o generen en la Plataforma.",
        "Servicios de terceros: Plataformas externas integradas, como Meta (WhatsApp, Instagram, Messenger), proveedores de telefonía, SMS, email, pagos y otros conectores habilitados en la Plataforma.",
      ],
    },
    {
      title: "4. Objeto y alcance",
      paragraphs: [
        "Integraciones SH ofrece acceso a Agent Platform, una solución tecnológica para crear y operar agentes de inteligencia artificial, chatbots, bandejas de atención humana, campañas de mensajería, automatizaciones y funcionalidades complementarias descritas en el sitio y en la documentación vigente del producto.",
        "El alcance funcional, límites de uso, canales disponibles, cupos y características específicas dependen del plan contratado, de la configuración realizada por el Cliente y de las condiciones de los proveedores externos integrados. Las condiciones comerciales particulares, anexos, cotizaciones o contratos suscritos entre las partes prevalecerán sobre estas disposiciones generales en caso de conflicto.",
      ],
    },
    {
      title: "5. Capacidad, registro y seguridad de la cuenta",
      paragraphs: [
        "Para utilizar determinadas funcionalidades, el Usuario deberá registrarse y proporcionar información veraz, completa y actualizada. El Usuario declara ser mayor de edad y contar con capacidad legal para contratar, o actuar debidamente representado o autorizado cuando se trate de persona jurídica.",
        "El Cliente es responsable de la confidencialidad de sus credenciales de acceso, de las actividades realizadas desde su cuenta y de designar usuarios autorizados dentro de su organización. Deberá notificar de inmediato a Integraciones SH cualquier uso no autorizado o incidente de seguridad relacionado con su cuenta.",
        "Integraciones SH podrá rechazar, suspender o cancelar registros cuando existan indicios de información falsa, uso indebido, incumplimiento de estos Términos o riesgo para la seguridad de la Plataforma o de terceros.",
      ],
    },
    {
      title: "6. Comercio electrónico y contratación a distancia",
      paragraphs: [
        "La contratación de servicios a través del sitio o de medios electrónicos se entiende realizada conforme a la Ley 527 de 1999 y demás normas sobre mensajes de datos y comercio electrónico. La aceptación de estos Términos, la selección de un plan y la confirmación de pago, cuando aplique, constituyen manifestación válida de consentimiento.",
        "Antes de contratar, el Usuario tendrá acceso a información clara sobre la naturaleza del servicio, características principales, precios aplicables, periodicidad de facturación, medios de pago y canales de atención. Integraciones SH conservará soporte de las transacciones y comunicaciones electrónicas en la medida exigida por la ley y sus políticas internas.",
      ],
    },
    {
      title: "7. Planes, precios, facturación y pagos",
      paragraphs: [
        "Los precios, planes, promociones y condiciones comerciales vigentes se publican en el sitio o se comunican por cotización. Salvo indicación expresa en contrario, los valores no incluyen impuestos, tasas o retenciones aplicables, los cuales serán asumidos conforme a la normatividad tributaria colombiana.",
        "El Cliente se obliga a mantener actualizados sus datos de facturación y a realizar los pagos en los plazos acordados. El incumplimiento en el pago podrá dar lugar a suspensión temporal del acceso, limitación de funcionalidades o terminación del servicio, previa comunicación cuando sea razonablemente posible.",
        "Los reembolsos, devoluciones o ajustes comerciales se regirán por la ley aplicable, el plan contratado y las políticas comerciales informadas al Cliente al momento de la compra. En ningún caso se entenderán autorizados reembolsos por uso indebido de la Plataforma o por incumplimiento atribuible al Cliente.",
      ],
    },
    {
      title: "8. Obligaciones de Integraciones SH",
      paragraphs: [
        "Integraciones SH se compromete, de manera diligente y conforme a la ley, a:",
        "Integraciones SH no garantiza resultados comerciales específicos derivados del uso de la Plataforma, ni la disponibilidad ininterrumpida de servicios de terceros sobre los cuales no tiene control.",
      ],
      listItems: [
        "Prestar el servicio contratado con base en las capacidades técnicas de Agent Platform.",
        "Implementar medidas razonables de seguridad para proteger la información tratada en el marco del servicio.",
        "Atender solicitudes de soporte y consultas a través de los canales habilitados, dentro de los tiempos razonables según el plan y la naturaleza de la solicitud.",
        "Informar cambios relevantes en estos Términos o en el servicio conforme a la sección de modificaciones.",
      ],
      listAfterParagraphs: 1,
    },
    {
      title: "9. Obligaciones del Usuario y del Cliente",
      paragraphs: ["El Usuario y, en particular, el Cliente, se obliga a:"],
      listItems: [
        "Utilizar el sitio y la Plataforma de forma lícita, diligente y conforme a estos Términos.",
        "Cumplir la normativa colombiana aplicable, incluyendo protección de datos personales, publicidad, telecomunicaciones, comercio electrónico y derechos de consumidores finales cuando corresponda.",
        "Obtener las autorizaciones, consentimientos y bases legales necesarias para tratar datos personales de sus contactos, clientes o usuarios finales a través de Agent Platform.",
        "Respetar las políticas de Meta, WhatsApp Business, Instagram, Messenger y demás proveedores integrados, incluyendo reglas de opt-in, plantillas, calidad del número y usos permitidos.",
        "No utilizar la Plataforma para enviar spam, contenido ilícito, difamatorio, fraudulento, discriminatorio o que vulnere derechos de terceros.",
        "Mantener actualizada la información registrada y responder por las acciones de sus usuarios autorizados, empleados, contratistas o subcuentas vinculadas a su organización.",
      ],
    },
    {
      title: "10. Usos prohibidos",
      paragraphs: [
        "Queda expresamente prohibido, sin limitarse a:",
        "El incumplimiento de esta sección podrá dar lugar a suspensión inmediata, terminación del contrato y las acciones legales pertinentes.",
      ],
      listItems: [
        "Intentar acceder sin autorización a sistemas, cuentas, datos o infraestructura de Integraciones SH o de terceros.",
        "Realizar ingeniería inversa, descompilar, copiar o reproducir la Plataforma salvo autorización escrita o mandato legal.",
        "Sobrecargar, interferir o comprometer la estabilidad, seguridad o integridad del servicio.",
        "Usar la Plataforma para actividades ilegales, lavado de activos, suplantación de identidad, phishing, distribución de malware o cualquier conducta sancionada por la ley penal o administrativa colombiana.",
        "Revender, sublicenciar o poner a disposición el servicio en condiciones no autorizadas, salvo planes o acuerdos expresamente habilitados para tal fin.",
      ],
      listAfterParagraphs: 1,
    },
    {
      title: "11. Propiedad intelectual y licencia de uso",
      paragraphs: [
        "El sitio, la Plataforma, su código, diseño, marcas, documentación, interfaces, know-how y demás elementos propios de Integraciones SH están protegidos por la legislación colombiana e internacional sobre propiedad intelectual, incluyendo la Ley 23 de 1982, el Decreto 1360 de 1989 y el Decreto 411 de 1996, según corresponda.",
        "Integraciones SH otorga al Cliente una licencia limitada, no exclusiva, revocable e intransferible para usar Agent Platform durante la vigencia del plan contratado y únicamente para sus fines internos o comerciales autorizados. Esta licencia no implica cesión de derechos de propiedad intelectual.",
        "El Cliente conserva la titularidad de su Contenido. No obstante, autoriza a Integraciones SH a alojar, procesar, transmitir, respaldar y utilizar dicho Contenido en la medida necesaria para prestar el servicio, dar soporte, cumplir obligaciones legales y mejorar la operación de la Plataforma.",
      ],
    },
    {
      title: "12. Protección de datos personales",
      paragraphs: [
        "El tratamiento de datos personales realizado por Integraciones SH se rige por la Ley 1581 de 2012, el Decreto 1377 de 2013 y demás normas concordantes, según se describe en la Política de Tratamiento de Datos Personales.",
        "Cuando el Cliente utilice Agent Platform para tratar datos de terceros, actuará como Responsable o Encargado según el caso, y deberá cumplir la normativa de habeas data, informar adecuadamente a los titulares, obtener autorizaciones cuando sean exigibles y atender consultas y reclamos conforme a la ley.",
        "Integraciones SH podrá tratar datos de registro, facturación, soporte, seguridad, analítica del servicio y cumplimiento legal conforme a su política de privacidad y a las instrucciones contractuales aplicables.",
      ],
    },
    {
      title: "13. Servicios y plataformas de terceros",
      paragraphs: [
        "Agent Platform se integra con servicios de terceros, tales como Meta, proveedores de telefonía, mensajería, pagos, inteligencia artificial y almacenamiento en la nube. El uso de dichos servicios está sujeto a los términos, políticas, tarifas, disponibilidad y restricciones de cada proveedor.",
        "Integraciones SH no es responsable por suspensiones, cambios de API, rechazo de plantillas, bloqueos de números, fallas de conectividad, decisiones de moderación o cualquier actuación atribuible a terceros. El Cliente es responsable de mantener activas sus cuentas, tokens, permisos y cumplimiento frente a dichos proveedores.",
        "El sitio puede contener enlaces a páginas externas. Integraciones SH no controla ni respalda el contenido, políticas o prácticas de sitios o servicios de terceros.",
      ],
    },
    {
      title: "14. Disponibilidad, mantenimiento, soporte y actualizaciones",
      paragraphs: [
        "Integraciones SH procura mantener la Plataforma disponible y actualizada, pero no garantiza operación ininterrumpida o libre de errores. Podrán realizarse mantenimientos programados o de emergencia, los cuales se procurará comunicar con antelación razonable cuando sea posible.",
        "Las actualizaciones, mejoras, cambios de interfaz o nuevas funcionalidades podrán implementarse sin previo aviso, siempre que no reduzcan de manera injustificada las capacidades esenciales contratadas durante un periodo ya pagado, salvo causas técnicas, legales o de seguridad.",
        "Los niveles de soporte, tiempos de respuesta y alcance de acompañamiento dependen del plan contratado y de los acuerdos comerciales aplicables.",
      ],
    },
    {
      title: "15. Garantías y limitación de responsabilidad",
      paragraphs: [
        'El servicio se presta "tal como está disponible" y "según disponibilidad", en los términos permitidos por la ley colombiana. En la medida máxima autorizada por la normativa aplicable, Integraciones SH excluye garantías implícitas de comerciabilidad, idoneidad para un propósito particular o no infracción, sin perjuicio de los derechos irrenunciables de los consumidores conforme a la Ley 1480 de 2011.',
        "Integraciones SH no será responsable por daños indirectos, lucro cesante, pérdida de datos, pérdida de oportunidad comercial, daño emergente excesivo o perjuicios derivados del uso o imposibilidad de uso de la Plataforma, de servicios de terceros, de fallas de internet, de fuerza mayor o de hechos imputables al Cliente o a sus usuarios finales.",
        "Cuando la ley no permita limitar determinada responsabilidad, la responsabilidad total de Integraciones SH frente al Cliente por cualquier reclamación relacionada con el servicio se limitará, en la medida permitida, al monto efectivamente pagado por el Cliente a Integraciones SH durante los tres (3) meses anteriores al hecho que originó la reclamación, salvo dolo o culpa grave debidamente probados.",
        "Las limitaciones anteriores no aplicarán en casos de vulneración de derechos irrenunciables del consumidor ni cuando una norma de orden público disponga lo contrario.",
      ],
    },
    {
      title: "16. Indemnidad",
      paragraphs: [
        "El Cliente se obliga a mantener indemne a Integraciones SH, sus representantes, empleados y proveedores frente a reclamaciones, sanciones, daños, costos y gastos, incluidos honorarios razonables de abogados, derivados del incumplimiento de estos Términos, del uso indebido de la Plataforma, del tratamiento ilícito de datos personales, de infracciones a derechos de terceros o del incumplimiento de políticas de proveedores externos, en la medida permitida por la ley colombiana.",
      ],
    },
    {
      title: "17. Duración, suspensión y terminación",
      paragraphs: [
        "Estos Términos permanecerán vigentes mientras el Usuario acceda al sitio o utilice los servicios. Los contratos por suscripción se regirán por la periodicidad del plan contratado y se renovarán automáticamente salvo cancelación conforme a las condiciones comerciales informadas.",
        "Integraciones SH podrá suspender o terminar el acceso, total o parcialmente, cuando exista incumplimiento de estos Términos, mora en el pago, riesgo de seguridad, orden de autoridad competente o uso que pueda afectar la estabilidad del servicio o derechos de terceros.",
        "El Cliente podrá cancelar su plan conforme a los mecanismos habilitados en la Plataforma o mediante solicitud a los canales de atención. La terminación no exime al Cliente del pago de sumas adeudadas ni de responsabilidades originadas con anterioridad.",
        "Tras la terminación, Integraciones SH podrá conservar determinada información durante los plazos exigidos por ley, fines de auditoría, resolución de controversias o respaldo operativo, conforme a la política de tratamiento de datos.",
      ],
    },
    {
      title: "18. Modificaciones",
      paragraphs: [
        "Integraciones SH podrá modificar estos Términos, las condiciones comerciales, funcionalidades o políticas del servicio. Los cambios relevantes serán informados a través del sitio, la Plataforma, correo electrónico u otros medios razonables.",
        "Si el Usuario continúa utilizando el servicio después de la entrada en vigencia de las modificaciones, se entenderá que las acepta. Cuando la ley exija consentimiento expreso o ofrezca derecho de retracto o terminación por cambios sustanciales, Integraciones SH actuará conforme a la normativa aplicable.",
      ],
    },
    {
      title: "19. Protección al consumidor y derecho de retracto",
      paragraphs: [
        "Cuando el Cliente tenga la calidad de consumidor conforme a la Ley 1480 de 2011, gozará de los derechos previstos en dicha norma y sus decretos reglamentarios, incluyendo, cuando proceda, información clara y veraz, protección contra cláusulas abusivas y mecanismos de atención de peticiones, quejas y reclamos.",
        "En contratos de venta o prestación de servicios celebrados por medios electrónicos con consumidores, podrá aplicarse el derecho de retracto dentro de los cinco (5) días hábiles siguientes a la contratación, conforme al artículo 47 de la Ley 1480 de 2011, siempre que no se trate de excepciones legales, tales como servicios ya ejecutados con consentimiento del consumidor, contenido digital no suministrado en soporte material cuando la ejecución haya comenzado, o supuestos expresamente previstos por la ley.",
        "Para ejercer derechos de consumidor, el Usuario podrá contactar a Integraciones SH por los canales indicados en estos Términos. Si no obtiene respuesta satisfactoria, podrá acudir ante la Superintendencia de Industria y Comercio u otras autoridades competentes en Colombia.",
      ],
    },
    {
      title: "20. Comunicaciones electrónicas",
      paragraphs: [
        "El Usuario autoriza a Integraciones SH a enviar comunicaciones relacionadas con el servicio, facturación, seguridad, soporte, actualizaciones y aspectos contractuales a través de correo electrónico, WhatsApp, notificaciones dentro de la Plataforma u otros medios electrónicos registrados, conforme a la Ley 527 de 1999.",
        "Las notificaciones enviadas a los datos de contacto registrados por el Cliente se entenderán válidamente realizadas, salvo que este demuestre error imputable a Integraciones SH en el registro o envío.",
      ],
    },
    {
      title: "21. Cesión",
      paragraphs: [
        "El Cliente no podrá ceder sus derechos u obligaciones derivados de estos Términos sin autorización previa y escrita de Integraciones SH, salvo en reorganizaciones societarias o transmisiones de negocio previamente informadas y no prohibidas por ley.",
        "Integraciones SH podrá ceder total o parcialmente el contrato o los derechos económicos del servicio a sociedades vinculadas o sucesoras, informando al Cliente cuando sea razonablemente requerido.",
      ],
    },
    {
      title: "22. Fuerza mayor y caso fortuito",
      paragraphs: [
        "Ninguna de las partes será responsable por el incumplimiento o retraso en el cumplimiento de sus obligaciones cuando éste se deba a fuerza mayor o caso fortuito conforme al Código Civil colombiano, incluyendo fallas generalizadas de internet, ataques cibernéticos masivos, actos de autoridad, conflictos armados, desastres naturales, apagones o indisponibilidad de proveedores esenciales ajenos al control razonable de la parte afectada.",
      ],
    },
    {
      title: "23. Ley aplicable, solución de controversias y jurisdicción",
      paragraphs: [
        "Estos Términos se rigen por las leyes de la República de Colombia. Cualquier controversia derivada de su interpretación o ejecución se someterá, en primera instancia, a mecanismos de solución directa y negociación entre las partes a través de los canales de atención de Integraciones SH.",
        "Si no se lograre acuerdo, las partes podrán acudir a mecanismos alternativos de solución de conflictos conforme a la ley colombiana. En defecto de solución amigable, la controversia será sometida a los jueces competentes de la República de Colombia, conforme a las reglas de jurisdicción aplicables, sin perjuicio de las competencias especiales de la Superintendencia de Industria y Comercio en materia de protección al consumidor.",
      ],
    },
    {
      title: "24. Disposiciones finales",
      paragraphs: [
        "Si alguna disposición de estos Términos fuere declarada inválida o ineficaz, las demás conservarán su plena vigencia. La no exigencia por parte de Integraciones SH del cumplimiento de cualquier obligación no constituirá renuncia a exigirlo posteriormente.",
        "Estos Términos, junto con la Política de Tratamiento de Datos Personales, la documentación comercial aplicable y los anexos contractuales suscritos por las partes, constituyen el acuerdo integral entre el Usuario y Integraciones SH respecto del objeto aquí regulado.",
        "Última actualización: 4 de septiembre de 2026.",
      ],
    },
    {
      title: "25. Contacto",
      paragraphs: [
        "Para consultas, peticiones, quejas o reclamos relacionados con estos Términos, puedes contactarnos por:",
      ],
      listItems: [
        "WhatsApp: +57 321-7455642",
        "Correo electrónico: info@integracionessh.lat",
        "Sitio web: integracionessh.lat",
      ],
    },
  ],
};

export const termsContentEn: TermsContent = {
  pageTitle: "Terms and conditions",
  sections: [
    {
      title: "1. Introduction and acceptance",
      paragraphs: [
        'These Terms and Conditions (the "Terms") govern access to and use of the website integracionessh.lat, the Agent Platform, and the services offered by Integraciones SH ("Integraciones SH", "we", or "the Provider").',
        "By accessing the site, creating an account, purchasing a plan, or using Agent Platform, the User declares that they have read, understood, and fully accepted these Terms. If you do not agree, you must refrain from using the site and services.",
        "These Terms are interpreted in accordance with the laws of the Republic of Colombia, including the Commercial Code, the Civil Code, Law 527 of 1999 on e-commerce and data messages, Law 1480 of 2011 (Consumer Statute), Law 1581 of 2012 and its regulatory decrees, and other applicable rules depending on the nature of the contractual relationship.",
      ],
    },
    {
      title: "2. Provider identification",
      paragraphs: [
        "The service is provided by Integraciones SH, domiciled in Colombia, with support channels available through:",
      ],
      listItems: [
        "Website: integracionessh.lat",
        "Email: info@integracionessh.lat",
        "WhatsApp: +57 321-7455642",
      ],
    },
    {
      title: "3. Definitions",
      listItems: [
        "User: Natural or legal person who accesses the site or uses the services, with or without a registered account.",
        "Client: User who purchases a paid plan or enters into a commercial agreement with Integraciones SH.",
        "Platform or Agent Platform: Software as a service (SaaS) for AI agent management, omnichannel communication, automation, inbox, campaigns, appointments, collections, and API.",
        "User Content: Data, messages, configurations, flows, contacts, and other information that the Client or its authorized users upload or generate on the Platform.",
        "Third-party services: External platforms integrated with the Platform, such as Meta (WhatsApp, Instagram, Messenger), telephony providers, SMS, email, payments, and other enabled connectors.",
      ],
    },
    {
      title: "4. Purpose and scope",
      paragraphs: [
        "Integraciones SH provides access to Agent Platform, a technology solution for creating and operating artificial intelligence agents, chatbots, human support inboxes, messaging campaigns, automations, and complementary features described on the site and in the current product documentation.",
        "Functional scope, usage limits, available channels, quotas, and specific features depend on the purchased plan, the Client's configuration, and the conditions of integrated external providers. Particular commercial conditions, annexes, quotes, or contracts signed between the parties shall prevail over these general provisions in case of conflict.",
      ],
    },
    {
      title: "5. Capacity, registration and account security",
      paragraphs: [
        "To use certain features, the User must register and provide truthful, complete, and up-to-date information. The User declares that they are of legal age and have legal capacity to contract, or act duly represented or authorized when acting on behalf of a legal entity.",
        "The Client is responsible for the confidentiality of their access credentials, activities performed from their account, and designating authorized users within their organization. They must immediately notify Integraciones SH of any unauthorized use or security incident related to their account.",
        "Integraciones SH may reject, suspend, or cancel registrations when there are indications of false information, misuse, breach of these Terms, or risk to the security of the Platform or third parties.",
      ],
    },
    {
      title: "6. E-commerce and distance contracting",
      paragraphs: [
        "Contracting services through the site or electronic means is understood to be carried out in accordance with Law 527 of 1999 and other rules on data messages and e-commerce. Acceptance of these Terms, selection of a plan, and payment confirmation, when applicable, constitute valid manifestation of consent.",
        "Before contracting, the User will have access to clear information about the nature of the service, main features, applicable prices, billing frequency, payment methods, and support channels. Integraciones SH will retain records of transactions and electronic communications to the extent required by law and its internal policies.",
      ],
    },
    {
      title: "7. Plans, pricing, billing and payments",
      paragraphs: [
        "Current prices, plans, promotions, and commercial conditions are published on the site or communicated by quote. Unless expressly stated otherwise, amounts do not include applicable taxes, fees, or withholdings, which shall be borne in accordance with Colombian tax regulations.",
        "The Client agrees to keep billing information up to date and make payments within agreed deadlines. Failure to pay may result in temporary suspension of access, limitation of features, or termination of the service, with prior notice when reasonably possible.",
        "Refunds, returns, or commercial adjustments shall be governed by applicable law, the purchased plan, and commercial policies informed to the Client at the time of purchase. Refunds shall in no case be authorized for misuse of the Platform or breach attributable to the Client.",
      ],
    },
    {
      title: "8. Integraciones SH obligations",
      paragraphs: [
        "Integraciones SH commits, diligently and in accordance with the law, to:",
        "Integraciones SH does not guarantee specific commercial results derived from use of the Platform, nor uninterrupted availability of third-party services over which it has no control.",
      ],
      listItems: [
        "Provide the contracted service based on the technical capabilities of Agent Platform.",
        "Implement reasonable security measures to protect information processed in the context of the service.",
        "Handle support requests and inquiries through enabled channels, within reasonable timeframes according to the plan and nature of the request.",
        "Inform of relevant changes to these Terms or the service in accordance with the modifications section.",
      ],
      listAfterParagraphs: 1,
    },
    {
      title: "9. User and Client obligations",
      paragraphs: ["The User and, in particular, the Client, agrees to:"],
      listItems: [
        "Use the site and Platform lawfully, diligently, and in accordance with these Terms.",
        "Comply with applicable Colombian regulations, including personal data protection, advertising, telecommunications, e-commerce, and end-consumer rights when applicable.",
        "Obtain the authorizations, consents, and legal bases necessary to process personal data of contacts, customers, or end users through Agent Platform.",
        "Comply with Meta, WhatsApp Business, Instagram, Messenger, and other integrated provider policies, including opt-in rules, templates, number quality, and permitted uses.",
        "Not use the Platform to send spam, unlawful, defamatory, fraudulent, discriminatory content, or content that violates third-party rights.",
        "Keep registered information up to date and be responsible for the actions of authorized users, employees, contractors, or sub-accounts linked to their organization.",
      ],
    },
    {
      title: "10. Prohibited uses",
      paragraphs: [
        "The following is expressly prohibited, without limitation:",
        "Breach of this section may result in immediate suspension, contract termination, and appropriate legal action.",
      ],
      listItems: [
        "Attempting unauthorized access to systems, accounts, data, or infrastructure of Integraciones SH or third parties.",
        "Reverse engineering, decompiling, copying, or reproducing the Platform except with written authorization or legal mandate.",
        "Overloading, interfering with, or compromising the stability, security, or integrity of the service.",
        "Using the Platform for illegal activities, money laundering, identity theft, phishing, malware distribution, or any conduct sanctioned by Colombian criminal or administrative law.",
        "Reselling, sublicensing, or making the service available under unauthorized conditions, except plans or agreements expressly enabled for such purpose.",
      ],
      listAfterParagraphs: 1,
    },
    {
      title: "11. Intellectual property and license of use",
      paragraphs: [
        "The site, Platform, its code, design, trademarks, documentation, interfaces, know-how, and other elements owned by Integraciones SH are protected by Colombian and international intellectual property legislation, including Law 23 of 1982, Decree 1360 of 1989, and Decree 411 of 1996, as applicable.",
        "Integraciones SH grants the Client a limited, non-exclusive, revocable, and non-transferable license to use Agent Platform during the term of the purchased plan and solely for authorized internal or commercial purposes. This license does not imply assignment of intellectual property rights.",
        "The Client retains ownership of their Content. However, they authorize Integraciones SH to host, process, transmit, back up, and use such Content to the extent necessary to provide the service, offer support, comply with legal obligations, and improve Platform operations.",
      ],
    },
    {
      title: "12. Personal data protection",
      paragraphs: [
        "Personal data processing by Integraciones SH is governed by Law 1581 of 2012, Decree 1377 of 2013, and related regulations, as described in the Personal Data Processing Policy.",
        "When the Client uses Agent Platform to process third-party data, they act as Controller or Processor as applicable, and must comply with habeas data regulations, adequately inform data subjects, obtain authorizations when required, and handle inquiries and claims in accordance with the law.",
        "Integraciones SH may process registration, billing, support, security, service analytics, and legal compliance data in accordance with its privacy policy and applicable contractual instructions.",
      ],
    },
    {
      title: "13. Third-party services and platforms",
      paragraphs: [
        "Agent Platform integrates with third-party services such as Meta, telephony providers, messaging, payments, artificial intelligence, and cloud storage. Use of such services is subject to each provider's terms, policies, fees, availability, and restrictions.",
        "Integraciones SH is not responsible for suspensions, API changes, template rejections, number blocks, connectivity failures, moderation decisions, or any action attributable to third parties. The Client is responsible for keeping their accounts, tokens, permissions, and compliance with such providers active.",
        "The site may contain links to external pages. Integraciones SH does not control or endorse the content, policies, or practices of third-party sites or services.",
      ],
    },
    {
      title: "14. Availability, maintenance, support and updates",
      paragraphs: [
        "Integraciones SH endeavors to keep the Platform available and updated, but does not guarantee uninterrupted or error-free operation. Scheduled or emergency maintenance may be performed, which will be communicated with reasonable advance notice when possible.",
        "Updates, improvements, interface changes, or new features may be implemented without prior notice, provided they do not unjustifiably reduce essential contracted capabilities during an already paid period, except for technical, legal, or security reasons.",
        "Support levels, response times, and scope of assistance depend on the purchased plan and applicable commercial agreements.",
      ],
    },
    {
      title: "15. Warranties and limitation of liability",
      paragraphs: [
        'The service is provided "as available" and "as is", to the extent permitted by Colombian law. To the maximum extent authorized by applicable regulations, Integraciones SH excludes implied warranties of merchantability, fitness for a particular purpose, or non-infringement, without prejudice to non-waivable consumer rights under Law 1480 of 2011.',
        "Integraciones SH shall not be liable for indirect damages, lost profits, data loss, loss of business opportunity, excessive consequential damages, or harm arising from use or inability to use the Platform, third-party services, internet failures, force majeure, or acts attributable to the Client or their end users.",
        "When the law does not allow limiting certain liability, Integraciones SH's total liability to the Client for any claim related to the service shall be limited, to the extent permitted, to the amount actually paid by the Client to Integraciones SH during the three (3) months prior to the event giving rise to the claim, except in cases of proven willful misconduct or gross negligence.",
        "The above limitations shall not apply in cases of violation of non-waivable consumer rights or when a public policy rule provides otherwise.",
      ],
    },
    {
      title: "16. Indemnity",
      paragraphs: [
        "The Client agrees to hold Integraciones SH, its representatives, employees, and providers harmless from claims, penalties, damages, costs, and expenses, including reasonable attorneys' fees, arising from breach of these Terms, misuse of the Platform, unlawful processing of personal data, infringement of third-party rights, or non-compliance with external provider policies, to the extent permitted by Colombian law.",
      ],
    },
    {
      title: "17. Duration, suspension and termination",
      paragraphs: [
        "These Terms shall remain in effect while the User accesses the site or uses the services. Subscription contracts shall be governed by the periodicity of the purchased plan and shall renew automatically unless canceled in accordance with informed commercial conditions.",
        "Integraciones SH may suspend or terminate access, in whole or in part, when there is breach of these Terms, payment default, security risk, order from competent authority, or use that may affect service stability or third-party rights.",
        "The Client may cancel their plan through mechanisms enabled on the Platform or by request through support channels. Termination does not exempt the Client from payment of amounts owed or responsibilities arising prior thereto.",
        "Upon termination, Integraciones SH may retain certain information for periods required by law, audit purposes, dispute resolution, or operational backup, in accordance with the data processing policy.",
      ],
    },
    {
      title: "18. Modifications",
      paragraphs: [
        "Integraciones SH may modify these Terms, commercial conditions, features, or service policies. Relevant changes will be communicated through the site, Platform, email, or other reasonable means.",
        "If the User continues using the service after modifications take effect, they shall be deemed accepted. When the law requires express consent or offers a right of withdrawal or termination due to material changes, Integraciones SH will act in accordance with applicable regulations.",
      ],
    },
    {
      title: "19. Consumer protection and right of withdrawal",
      paragraphs: [
        "When the Client qualifies as a consumer under Law 1480 of 2011, they shall enjoy the rights provided therein and its regulatory decrees, including, when applicable, clear and truthful information, protection against abusive clauses, and mechanisms for handling petitions, complaints, and claims.",
        "In contracts for sale or provision of services entered into by electronic means with consumers, the right of withdrawal may apply within five (5) business days following contracting, in accordance with Article 47 of Law 1480 of 2011, provided legal exceptions do not apply, such as services already performed with consumer consent, digital content not supplied on a tangible medium when execution has begun, or cases expressly provided by law.",
        "To exercise consumer rights, the User may contact Integraciones SH through the channels indicated in these Terms. If they do not obtain a satisfactory response, they may turn to the Superintendence of Industry and Commerce or other competent authorities in Colombia.",
      ],
    },
    {
      title: "20. Electronic communications",
      paragraphs: [
        "The User authorizes Integraciones SH to send communications related to the service, billing, security, support, updates, and contractual matters via email, WhatsApp, notifications within the Platform, or other registered electronic means, in accordance with Law 527 of 1999.",
        "Notifications sent to contact details registered by the Client shall be deemed validly delivered, unless the Client demonstrates error attributable to Integraciones SH in registration or delivery.",
      ],
    },
    {
      title: "21. Assignment",
      paragraphs: [
        "The Client may not assign their rights or obligations under these Terms without prior written authorization from Integraciones SH, except in corporate reorganizations or business transfers previously informed and not prohibited by law.",
        "Integraciones SH may assign the contract or economic rights to the service in whole or in part to affiliated or successor companies, informing the Client when reasonably required.",
      ],
    },
    {
      title: "22. Force majeure and fortuitous event",
      paragraphs: [
        "Neither party shall be liable for failure or delay in fulfilling obligations when due to force majeure or fortuitous event under the Colombian Civil Code, including widespread internet failures, massive cyberattacks, acts of authority, armed conflicts, natural disasters, power outages, or unavailability of essential providers beyond the reasonable control of the affected party.",
      ],
    },
    {
      title: "23. Applicable law, dispute resolution and jurisdiction",
      paragraphs: [
        "These Terms are governed by the laws of the Republic of Colombia. Any dispute arising from their interpretation or execution shall first be submitted to direct resolution and negotiation between the parties through Integraciones SH support channels.",
        "If no agreement is reached, the parties may resort to alternative dispute resolution mechanisms under Colombian law. Failing amicable resolution, the dispute shall be submitted to the competent courts of the Republic of Colombia, in accordance with applicable jurisdiction rules, without prejudice to the special powers of the Superintendence of Industry and Commerce in consumer protection matters.",
      ],
    },
    {
      title: "24. Final provisions",
      paragraphs: [
        "If any provision of these Terms is declared invalid or ineffective, the remaining provisions shall remain in full force. Failure by Integraciones SH to enforce any obligation shall not constitute waiver of enforcement thereafter.",
        "These Terms, together with the Personal Data Processing Policy, applicable commercial documentation, and contractual annexes signed by the parties, constitute the entire agreement between the User and Integraciones SH regarding the subject matter regulated herein.",
        "Last updated: September 4, 2026.",
      ],
    },
    {
      title: "25. Contact",
      paragraphs: [
        "For inquiries, requests, complaints, or claims related to these Terms, you can contact us at:",
      ],
      listItems: [
        "WhatsApp: +57 321-7455642",
        "Email: info@integracionessh.lat",
        "Website: integracionessh.lat",
      ],
    },
  ],
};

export const termsContent: Record<"es" | "en", TermsContent> = {
  es: termsContentEs,
  en: termsContentEn,
};
