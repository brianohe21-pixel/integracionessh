export type PrivacySection = {
  title: string;
  paragraphs?: string[];
  listItems?: string[];
  listAfterParagraphs?: number;
};

export type PrivacyChapter = {
  title: string;
  sections: PrivacySection[];
};

export type PrivacyPolicyContent = {
  pageTitle: string;
  policy: {
    title: string;
    intro: string;
    updated: string;
    sections: PrivacySection[];
    contact: PrivacySection;
  };
  dataTreatment: {
    title: string;
    subtitle: string;
    introductionTitle: string;
    introduction: string[];
    chapters: PrivacyChapter[];
    effectiveDate: string;
  };
};

export const privacyContentEs: PrivacyPolicyContent = {
  pageTitle: "Privacidad y Tratamiento de Datos",
  policy: {
    title: "Política de privacidad",
    intro:
      "En Integraciones SH respetamos tu privacidad. Esta Política de Privacidad explica de forma clara qué información recopilamos cuando visitas nuestro sitio web, cómo la usamos y qué opciones tienes. Complementa la Política de Tratamiento de Datos Personales publicada en esta misma página, conforme a la Ley 1581 de 2012 y demás normas colombianas aplicables.",
    updated: "Última actualización de la Política de Privacidad: 4 de septiembre de 2026.",
    sections: [
      {
        title: "Responsable del tratamiento",
        paragraphs: [
          "El responsable del tratamiento de los datos personales recopilados a través de este sitio es Integraciones SH, con sede en Colombia. Puedes contactarnos por:",
        ],
        listItems: [
          "Sitio web: integracionessh.lat",
          "Correo: info@integracionessh.lat",
          "WhatsApp: +57 321-7455642",
        ],
      },
      {
        title: "Datos que recopilamos",
        listItems: [
          "Datos de contacto voluntarios: nombre, número de teléfono, correo electrónico y contenido de mensajes cuando nos escribes por WhatsApp, formularios o canales de atención.",
          "Datos de navegación: páginas visitadas, tipo de dispositivo, navegador, idioma, origen del tráfico y eventos de interacción, de forma agregada o seudonimizada.",
          "Preferencias de cookies: tu elección de aceptar o rechazar el seguimiento analítico, almacenada localmente en tu navegador.",
          "Datos de registro en Agent Platform: si creas una cuenta en la plataforma, aplican además las condiciones del servicio y la política de tratamiento de datos para usuarios de la plataforma.",
        ],
        paragraphs: [
          "A través de este sitio web podemos recopilar:",
          "No solicitamos datos sensibles a través de este sitio salvo que tú los proporciones voluntariamente al contactarnos.",
        ],
      },
      {
        title: "Para qué usamos tu información",
        listItems: [
          "Responder consultas, demos, cotizaciones y solicitudes de soporte.",
          "Informarte sobre Agent Platform y los servicios de Integraciones SH.",
          "Medir el uso del sitio y mejorar contenidos, navegación y experiencia.",
          "Cumplir obligaciones legales, contables y de seguridad.",
          "Prevenir usos fraudulentos o no autorizados del sitio.",
        ],
        paragraphs: [
          "Utilizamos los datos recopilados para:",
          "No vendemos ni alquilamos tu información personal a terceros. Solo compartimos datos cuando es necesario para prestar el servicio, cumplir la ley o con tu autorización.",
        ],
      },
      {
        title: "Base legal del tratamiento",
        paragraphs: [
          "El tratamiento de tus datos se fundamenta, según el caso, en tu consentimiento, la ejecución de medidas precontractuales o contractuales, el interés legítimo de Integraciones SH en operar y mejorar el sitio, o el cumplimiento de obligaciones legales, conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013.",
        ],
      },
      {
        title: "Cookies y tecnologías similares",
        listItems: [
          "Cookies técnicas o de preferencia: guardan tu decisión sobre el banner de cookies (aceptar o rechazar analítica).",
          "Google Analytics 4: solo se activa si aceptas el seguimiento analítico. Recopila datos de uso de forma agregada, con dirección IP anonimizada. No usamos publicidad personalizada ni cookies de remarketing en este sitio.",
        ],
        paragraphs: [
          "Este sitio utiliza cookies y tecnologías de almacenamiento local para recordar tus preferencias y medir el tráfico. En particular:",
          "Puedes aceptar o rechazar la analítica desde el banner de cookies al visitar el sitio. También puedes eliminar cookies desde la configuración de tu navegador o instalar el complemento de inhabilitación de Google Analytics.",
          "Si rechazas las cookies analíticas, el sitio seguirá funcionando con normalidad; solo se limitará la medición estadística del tráfico.",
        ],
      },
      {
        title: "Terceros y enlaces externos",
        paragraphs: [
          "El sitio puede enlazar a servicios de terceros, como WhatsApp, redes sociales, la plataforma Agent Platform o documentación de API. Al salir de nuestro sitio, aplican las políticas de privacidad de esos proveedores.",
          "Cuando haces clic en un enlace de WhatsApp o te registras en la plataforma, el tratamiento de tus datos en ese entorno se rige por los términos del respectivo servicio y por nuestra política de tratamiento de datos cuando Integraciones SH actúe como responsable o encargado.",
        ],
      },
      {
        title: "Conservación de los datos",
        paragraphs: [
          "Conservamos la información el tiempo necesario para cumplir las finalidades descritas, atender solicitudes, mantener relaciones comerciales y cumplir obligaciones legales. Los datos de analítica se conservan según los períodos configurados en Google Analytics y las políticas de retención de Integraciones SH.",
        ],
      },
      {
        title: "Tus derechos",
        paragraphs: [
          "Como titular de datos personales en Colombia, puedes conocer, actualizar, rectificar y suprimir tu información, revocar autorizaciones cuando proceda, y presentar consultas o reclamos ante Integraciones SH o ante la Superintendencia de Industria y Comercio.",
          "Los canales, plazos y procedimientos detallados para ejercer estos derechos se encuentran en la Política de Tratamiento de Datos Personales de esta página.",
        ],
      },
      {
        title: "Seguridad",
        paragraphs: [
          "Aplicamos medidas técnicas, humanas y administrativas razonables para proteger la información contra acceso no autorizado, pérdida, alteración o divulgación indebida. Ningún sistema es completamente infalible; te recomendamos no enviar información sensible por canales no seguros.",
        ],
      },
      {
        title: "Menores de edad",
        paragraphs: [
          "Este sitio y los servicios de Integraciones SH están dirigidos a personas mayores de edad o con autorización de su representante legal. No recopilamos intencionalmente datos de menores de 18 años. Si detectamos que se han recopilado sin autorización, procederemos a eliminarlos.",
        ],
      },
      {
        title: "Cambios a esta política",
        paragraphs: [
          "Podemos actualizar esta Política de Privacidad para reflejar cambios en el sitio, en la ley o en nuestras prácticas. La fecha de la última actualización se indicará al final de esta sección. Te recomendamos revisar esta página periódicamente.",
        ],
      },
    ],
    contact: {
      title: "Contacto",
      paragraphs: [
        "Para ejercer tus derechos o resolver dudas sobre privacidad, escríbenos a info@integracionessh.lat, por WhatsApp al +57 321-7455642 o consulta los Términos y condiciones del sitio.",
      ],
    },
  },
  dataTreatment: {
    title: "Política de Tratamiento de Datos Personales",
    subtitle:
      "Documento formal conforme a la Ley 1581 de 2012, la Ley 1266 de 2008 y normas concordantes.",
    introductionTitle: "Introducción",
    introduction: [
      "Integraciones SH es una empresa especializada en soluciones de automatización, agentes de inteligencia artificial y comunicación omnicanal para PyMEs, con plataforma Agent Platform para WhatsApp Business, chatbots, inbox, campañas, cobros y API.",
      "Integraciones SH es respetuosa de las personas y por ende de sus datos personales, por ello busca informar de manera suficiente a las personas sobre los derechos que tienen en su calidad de titulares de la información.",
      "Es importante precisar que los derechos de los titulares de la información en desarrollo de la Ley Especial, en particular los referidos al Art. 16 sobre \"Peticiones, Consultas y Reclamos\", están previstos en los manuales internos de la Compañía.",
    ],
    chapters: [
      {
        title: "Capítulo I — Aspectos generales",
        sections: [
          {
            title: "1.1 Derecho de Habeas Data",
            paragraphs: [
              "El Art. 15 de la C.P. establece el derecho que tienen todas las personas a conocer, actualizar y rectificar las informaciones que se hayan recogido sobre ellas en bases de datos o archivos tanto de entidades públicas como privadas. Así mismo, y de acuerdo con la Sentencia C-748 de 2011 de la Corte Constitucional, este derecho comprende otras facultades como las de autorizar el tratamiento, incluir nuevos datos, excluirlos o suprimirlos de una base de datos o archivo.",
              "Este derecho fue desarrollado de manera jurisprudencial desde el año 1991 hasta el año 2008, en el cual se expidió la Ley Especial de Habeas Data, que regula lo que se ha denominado como el \"hábeas data financiero\", entendiéndose por éste el derecho que tiene todo individuo a conocer, actualizar y rectificar su información personal comercial, crediticia y financiera contenida en centrales de información públicas o privadas, que tienen como función recopilar, tratar y circular esos datos con el fin de determinar el nivel de riesgo financiero de su Titular. Esta Ley Especial considera como Titular de la información tanto a las personas naturales como jurídicas.",
              "Posteriormente, el 17 de octubre del año 2012 se expidió la Ley 1581 \"General de Protección de Datos Personales\", que desarrolla el derecho de Hábeas Data desde una perspectiva más amplia que la financiera y crediticia mencionada anteriormente. De esta manera, cualquier titular de datos personales tiene la facultad de controlar la información que de sí mismo ha sido recolectada en cualquier base de datos o archivo, administrado por entidades privadas o públicas. Bajo esta Ley General es titular la persona natural. Solamente, en situaciones especiales previstas por la Corte Constitucional en la Sentencia C-748 de 2011, podría llegar a serlo la persona jurídica.",
            ],
          },
          {
            title: "1.2 Diferenciación regímenes Ley 1266 de 2008 y Ley 1581 de 2012",
            paragraphs: [
              "La Ley 1581 de 2012 (Ley General) estableció que sus disposiciones no le eran aplicables a los archivos y bases de datos regulados bajo la Ley 1266 de 2008 (Ley Especial). Sin embargo, estableció que los principios de la Ley Especial se deben aplicar de manera concurrente con los de la Ley General.",
              "En consecuencia, Integraciones SH ha considerado importante aclarar a nivel de sus procesos internos aquellos aspectos que, siendo propios del desarrollo de la relación comercial y financiera establecida entre el titular de los datos y Integraciones SH, deben ser regidos por la Ley Especial, y ha introducido los cambios pertinentes en los procesos correspondientes de sus áreas de operación y atención al cliente.",
              "Integraciones SH garantizará en todo momento el acceso a sus Políticas de Tratamiento y pondrá especial esfuerzo en la atención completa y oportuna de las consultas que puedan formular los titulares de datos, bajo la Ley General.",
              "Los procesos de atención establecidos bajo la Ley Especial continúan vigentes.",
            ],
          },
          {
            title: "1.3 Objeto",
            paragraphs: [
              "La política y los procedimientos previstos en este documento buscan desarrollar de manera suficiente el derecho constitucional al Hábeas Data que tienen todas las personas respecto de las cuales Integraciones SH haya recogido, administre o conserve información de carácter personal.",
              "Para estos efectos Integraciones SH tiene claramente establecido que los derechos de los titulares de la información que tienen la calidad de usuarios de la plataforma, clientes comerciales o contactos gestionados a través de los servicios de Integraciones SH, en desarrollo de su relación contractual o comercial, se rigen principalmente por las disposiciones establecidas en la Ley General 1581 de 2012, y en los casos de datos financieros o crediticios aplicará de manera concurrente la Ley Especial 1266 de 2008.",
            ],
          },
          {
            title: "1.4 Ámbito de aplicación",
            paragraphs: [
              "La Política será aplicable a las bases de datos que se encuentren bajo la administración de Integraciones SH, o sean susceptibles de ser conocidas por ésta compañía en virtud de las relaciones comerciales desarrolladas con aliados comerciales, aliados estratégicos o convenios. En el primer caso Integraciones SH actuará como Responsable; en los demás casos podría tener la calidad de Encargado o de Responsable, dependiendo de si los recibe de un tercero o ella misma los recaba.",
            ],
          },
          {
            title: "1.5 Alcance",
            paragraphs: [
              "Todos los colaboradores de Integraciones SH quedan cubiertos bajo esta política. Integraciones SH adelantará las campañas pedagógicas y de capacitación requeridas, para que las áreas que tienen un mayor nivel de interacción con la administración de datos personales, conozcan la normativa vigente y las disposiciones adoptadas por la Sociedad para asegurar su cumplimiento.",
              "Así mismo, a los Aliados Estratégicos, Proveedores y Contratistas de Integraciones SH que tengan acceso a los datos personales de Titulares que se los hayan suministrado a Integraciones SH se les exigirá el cumplimiento de la Ley y de esta política.",
            ],
          },
          {
            title: "1.6 Definiciones",
            paragraphs: [
              "Con el fin de que los destinatarios de esta política tengan claridad sobre los términos utilizados a lo largo de la misma, a continuación se incluyen las definiciones que trae la Ley General, así como las referidas a la clasificación de los datos de acuerdo con la Ley Especial.",
            ],
            listItems: [
              "Autorización: Consentimiento previo, expreso e informado del Titular para llevar a cabo el Tratamiento de datos personales.",
              "Base de Datos: Conjunto organizado de datos personales que sea objeto de tratamiento, tanto por entidades públicas como privadas. Incluye aquellos depósitos de datos que constan en documentos y que tienen la calidad de archivos.",
              "Dato personal: Cualquier información vinculada o que pueda asociarse a una o varias personas naturales determinadas o determinables.",
              "Clasificación bajo la Ley Especial: privados, semiprivados y públicos. El dato privado es el dato que por su naturaleza íntima o reservada sólo es relevante para el titular. El dato semiprivado es aquel que no tiene naturaleza íntima, reservada ni pública y cuyo conocimiento o divulgación puede interesar no sólo a su titular sino a cierto sector o grupo de personas o a la sociedad en general, como el dato financiero y crediticio. El dato público es el dato calificado como tal según los mandatos de la ley o de la Constitución Política.",
              "Clasificación bajo la Ley General: públicos, semiprivados, privados y sensibles. Los datos sensibles son aquellos que afectan la intimidad del titular o cuyo uso indebido puede generar su discriminación.",
              "Encargado del Tratamiento: Persona natural o jurídica, pública o privada, que por sí misma o en asocio con otros, realice el tratamiento de datos personales por cuenta del responsable del tratamiento.",
              "Responsable del Tratamiento: Persona natural o jurídica, pública o privada, que por sí misma o en asocio con otros, decida sobre la base de datos y/o el Tratamiento de los datos.",
              "Titular: Persona natural cuyos datos personales sean objeto de Tratamiento.",
              "Tratamiento: Cualquier operación o conjunto de operaciones sobre datos personales, tales como la recolección, almacenamiento, uso o circulación.",
            ],
          },
        ],
      },
      {
        title: "Capítulo II — Principios rectores",
        sections: [
          {
            title: "Principios",
            paragraphs: [
              "Es un compromiso de Integraciones SH el entender y desarrollar de manera armónica los principios establecidos en ambos regímenes, tanto en el correspondiente a la Ley Especial, como en el de la Ley General.",
              "2.1 Principio de legalidad: El tratamiento es una actividad reglada que debe sujetarse a lo establecido en la ley y en las demás disposiciones que la desarrollen.",
              "2.2 Principio de finalidad: El tratamiento debe obedecer a una finalidad legítima de acuerdo con la Constitución y la Ley, la cual debe ser informada al titular.",
              "2.3 Principio de libertad: El tratamiento sólo puede ejercerse con el consentimiento previo, expreso e informado del titular, salvo mandato legal o judicial que releve el consentimiento.",
              "2.4 Principio de veracidad o calidad: La información sujeta a Tratamiento debe ser veraz, completa, exacta, actualizada, comprobable y comprensible.",
              "2.5 Principio de transparencia: En el tratamiento debe garantizarse el derecho del titular a obtener información acerca de la existencia de datos que le conciernan.",
              "2.6 Principio de acceso y circulación restringida: El tratamiento se sujeta a los límites que se derivan de la naturaleza de los datos personales y de las disposiciones legales aplicables.",
              "2.7 Principio de seguridad: La información sujeta a tratamiento se deberá manejar con las medidas técnicas, humanas y administrativas necesarias para otorgar seguridad a los registros.",
              "2.8 Principio de confidencialidad: Todas las personas que intervengan en el tratamiento de datos personales están obligadas a garantizar la reserva de la información.",
              "2.9 Necesidad y proporcionalidad: Los datos personales registrados deben ser los estrictamente necesarios para el cumplimiento de las finalidades del tratamiento.",
              "2.10 Temporalidad o caducidad: El período de conservación de los datos personales será el necesario para alcanzar la finalidad para la cual se han recolectado.",
              "2.11 Interpretación integral de derechos constitucionales: La Ley 1581 de 2012 se interpretará en el sentido de que se amparen adecuadamente los derechos constitucionales, como el hábeas data, el derecho al buen nombre, a la honra, a la intimidad y a la información.",
              "Integraciones SH en desarrollo del principio de legalidad velará porque los datos sean adquiridos, tratados y manejados de manera lícita. Cuando actúe como responsable del tratamiento, informará al titular de manera clara, suficiente y previa acerca de la o las finalidades de la información a ser suministrada, recaudará los datos estrictamente necesarios y respetará la libertad del titular para autorizar o no el uso de sus datos personales.",
            ],
          },
        ],
      },
      {
        title: "Capítulo III — Derechos de los titulares e identificación de las bases de datos",
        sections: [
          {
            title: "3.1 Derechos de los titulares",
            listAfterParagraphs: 0,
            listItems: [
              "Dirigirse a Integraciones SH, a través de los canales establecidos en el Aviso de Privacidad de Datos, con el fin de conocer, actualizar y rectificar sus datos personales.",
              "Solicitar prueba de la autorización otorgada a Integraciones SH, salvo cuando de acuerdo con la Ley el tratamiento no lo requiera. El tratamiento de los datos obedece a lo establecido en los contratos comerciales y términos de servicio que los usuarios han aceptado con Integraciones SH al utilizar la plataforma Agent Platform y los servicios asociados.",
              "Ser informado por Integraciones SH, previa solicitud efectuada a través de los canales dispuestos, respecto del uso que ésta le ha dado a sus datos personales.",
              "Presentar ante la Superintendencia de Industria y Comercio quejas por infracciones a la Ley General y sus decretos reglamentarios.",
              "Revocar, en aquellos casos que no se enmarcan bajo la Ley Especial de Hábeas Data Financiero, la autorización y/o solicitar la supresión del dato cuando en el Tratamiento no se respeten los principios, derechos y garantías constitucionales y legales.",
              "Acceder en forma gratuita, a través de los canales dispuestos por Integraciones SH, a sus datos personales que hayan sido objeto de tratamiento.",
            ],
            paragraphs: [
              "Integraciones SH a través de su Aviso de Privacidad de Datos informará acerca de los canales y procedimientos previstos para que el titular pueda ejercer sus derechos de manera efectiva.",
            ],
          },
          {
            title: "3.2 Autorización",
            listAfterParagraphs: 2,
            listItems: [
              "Información requerida por una entidad pública o administrativa en ejercicio de sus funciones legales o por orden judicial.",
              "Datos de naturaleza pública.",
              "Casos de urgencia médica o sanitaria.",
              "Tratamiento de información autorizado por la ley para fines históricos, estadísticos o científicos.",
              "Datos relacionados con el Registro Civil de las Personas.",
            ],
            paragraphs: [
              "Sin perjuicio de las excepciones previstas en la Ley, en el tratamiento se requiere la autorización previa e informada del titular, la cual deberá ser obtenida por cualquier medio que pueda ser objeto de consulta posterior.",
              "La autorización del titular no será necesaria cuando se trate de:",
              "Integraciones SH cuando se encuentre frente a alguna de estas situaciones lo dejará claramente revelado y en todo caso cumplirá con las demás disposiciones contenidas en la Ley.",
            ],
          },
          {
            title: "3.3 Identificación de las bases de datos",
            paragraphs: ["Integraciones SH ha identificado las siguientes bases de datos:"],
            listItems: [
              "De usuarios activos de la plataforma Agent Platform.",
              "De clientes comerciales actuales.",
              "De clientes comerciales sin relación vigente.",
              "De prospectos e interesados en los servicios.",
              "De proveedores.",
              "De empleados.",
              "De ex empleados.",
              "De contactos finales gestionados en nombre de clientes de la plataforma.",
            ],
          },
          {
            title: "3.4 Finalidad",
            paragraphs: [
              "Integraciones SH busca mantener informados a los usuarios y clientes sobre el estado de sus servicios contratados, alternativas de uso de la plataforma, soporte técnico, facturación y beneficios adicionales que les permitan aprovechar al máximo Agent Platform.",
              "La base de datos de prospectos persigue registrar el interés en los servicios y facilitar la comunicación comercial. La base de datos de proveedores persigue tener información actualizada y suficiente acerca de las personas que tienen la calidad de proveedores. La base de datos de empleados busca tener actualizada la información de los colaboradores con el fin de que la relación laboral se desarrolle de manera adecuada. La base de datos de ex empleados busca tener a disposición de las autoridades, o del mismo titular, su información durante el término establecido en la ley laboral.",
            ],
          },
          {
            title: "3.5 Vigencia",
            paragraphs: [
              "Los datos se conservan de acuerdo con los principios de necesidad y razonabilidad. Los de empleados y proveedores de acuerdo con los términos de Ley.",
            ],
          },
          {
            title: "3.6 Canales de suministro de la información",
            paragraphs: ["Integraciones SH establece como canales de comunicación con los titulares:"],
            listItems: [
              "Página web: integracionessh.lat",
              "Correo electrónico: info@integracionessh.lat",
              "WhatsApp: +57 321-7455642",
            ],
          },
        ],
      },
      {
        title: "Capítulo IV — Deberes en calidad de responsable y encargado del tratamiento",
        sections: [
          {
            title: "4.1 Deberes en calidad de responsable del tratamiento",
            paragraphs: [
              "La Ley General define al Responsable como la persona natural o jurídica que decide sobre la base de datos y/o el tratamiento de los datos. De conformidad con la Sentencia C-748 de 2011, es quien define los fines y medios esenciales para el tratamiento del dato.",
            ],
            listItems: [
              "Garantizar a través de los canales de atención establecidos el pleno y efectivo ejercicio del derecho de hábeas data.",
              "Conservar las autorizaciones otorgadas por los Titulares cuando consten por escrito, de manera telefónica o a través de la página web o correo electrónico.",
              "Informar acerca de la finalidad de la recolección, tanto en el texto de autorización como en el Aviso de Privacidad de Datos.",
              "En el evento de utilizar información de aliados estratégicos, solicitar certificación de que la información cuente con las autorizaciones correspondientes.",
              "Incluir los derechos del titular en el Aviso de Privacidad de Datos publicado en la página web.",
              "Implementar medidas de seguridad para impedir la adulteración, pérdida, consulta o uso no autorizado, conforme a los manuales internos desarrollados según la normatividad vigente.",
              "Establecer controles que permitan velar por la veracidad, completitud y actualización de la información suministrada a encargados del tratamiento.",
              "Informar a la Superintendencia de Industria y Comercio los incidentes de seguridad que puedan poner en peligro la administración de la información de los Titulares.",
              "Dar seguimiento a las instrucciones y requerimientos formulados por la Superintendencia de Industria y Comercio.",
            ],
          },
          {
            title: "4.2 Deberes en calidad de encargado del tratamiento",
            paragraphs: [
              "Integraciones SH utiliza y procesa datos de contactos finales en desarrollo de los contratos firmados entre sus clientes comerciales y la plataforma Agent Platform. En ese sentido, el actuar de Integraciones SH puede calificarse como Encargado del tratamiento, definido por la ley como quien realiza el tratamiento de datos personales por cuenta del responsable.",
              "Existirán canales eficientes que permitan que las actualizaciones de la información realizadas por el responsable se reciban y tramiten en el término de cinco (5) días hábiles previsto en la Ley.",
              "Se permitirá el acceso a la información únicamente a las personas autorizadas por la Ley. Se atenderán los requisitos que deben cumplir las Autoridades Judiciales y Administrativas, así como los titulares, apoderados o causahabientes que soliciten información.",
            ],
          },
          {
            title: "4.3 Nivel de medidas de seguridad aplicado al tratamiento",
            paragraphs: [
              "Integraciones SH acoge prácticas de seguridad de la información que aseguran el cumplimiento de los requisitos exigidos en materia de seguridad. En los contratos celebrados con los encargados se incluyen cláusulas que establecen de manera clara el deber de garantizar la seguridad y privacidad de la información del Titular.",
            ],
          },
        ],
      },
      {
        title: "Capítulo V — Procedimientos para garantizar el ejercicio de los derechos de los titulares",
        sections: [
          {
            title: "5.1 Consultas",
            listAfterParagraphs: 2,
            listItems: [
              "Solicitudes presentadas a través de documento escrito: adjuntar copia de la cédula.",
              "Solicitudes presentadas a través de los canales digitales de Integraciones SH, siguiendo las instrucciones definidas para este propósito.",
            ],
            paragraphs: [
              "En desarrollo del artículo 14 de la Ley, los Titulares o sus causahabientes podrán consultar la información que de éste repose en las bases de datos administradas por Integraciones SH.",
              "Los Titulares deberán acreditar su identidad de la siguiente manera:",
              "Los causahabientes deberán acreditar el parentesco adjuntando copia de la escritura donde se dé apertura a la sucesión y copia de su documento de identidad. Los apoderados deberán presentar copia auténtica del poder y de su documento de identidad.",
              "Una vez recibida la solicitud, Integraciones SH procederá a revisar el registro individual que corresponda al nombre del Titular y al número de documento de identidad aportado. Si encontrare alguna diferencia entre estos dos datos lo informará dentro de los cinco (5) días hábiles siguientes a su recibo. Si hay conformidad, procederá a dar respuesta en un término de diez (10) días hábiles. Si requiere mayor tiempo, informará al titular y dará respuesta en un término que no excederá de cinco (5) días hábiles adicionales.",
            ],
          },
          {
            title: "5.2 Reclamos",
            listItems: [
              "El reclamo se formulará acompañado del documento que identifique al titular, la descripción clara de los hechos, la dirección de notificación y los documentos de soporte.",
              "Si el reclamo resulta incompleto se requerirá al interesado dentro de los cinco (5) días siguientes para que subsane las fallas.",
              "Transcurridos dos (2) meses desde el requerimiento sin respuesta, se entenderá que ha desistido del reclamo.",
              "Si Integraciones SH no es competente para resolverlo, dará traslado a quien corresponda en un término máximo de dos (2) días hábiles e informará al interesado.",
              "Una vez recibido el reclamo completo, se incluirá en la base de datos la leyenda \"reclamo en trámite\" y el motivo del mismo, en un término máximo de dos (2) días hábiles.",
              "El término máximo para responder el reclamo es de quince (15) días hábiles; si no es posible, se informará al interesado y se atenderá en un plazo adicional de hasta ocho (8) días hábiles.",
            ],
            paragraphs: [
              "El titular o sus causahabientes que consideren que la información contenida en una base de datos administrada por Integraciones SH debe ser sujeta de corrección, actualización o supresión, o si advierten un incumplimiento de Integraciones SH o de alguno de sus encargados, podrán presentar un reclamo ante Integraciones SH en los siguientes términos:",
              "Integraciones SH utilizará un correo electrónico único para estos efectos, de tal manera que se pueda identificar en qué momento se da traslado y la respuesta correspondiente. Si Integraciones SH no conoce la persona a quien deba trasladarlo, informará de inmediato al Titular con copia a la Superintendencia de Industria y Comercio.",
            ],
          },
          {
            title: "5.3 Quejas ante la Superintendencia de Industria y Comercio",
            paragraphs: [
              "El titular, causahabiente o apoderado deberá agotar en primer lugar el trámite de consulta o reclamo, antes de dirigirse a la Superintendencia de Industria y Comercio para formular una queja.",
            ],
          },
          {
            title: "5.4 Persona o dependencia responsable de la atención de peticiones, consultas y reclamos",
            paragraphs: [
              "El área de Servicio al Cliente será responsable de velar por el cumplimiento de estas disposiciones. Esta área tendrá comunicación directa con los responsables de las diferentes áreas de la compañía, con el fin de garantizar que todos los aspectos señalados queden debidamente recogidos y que los deberes que estipula la Ley se cumplan.",
            ],
          },
          {
            title: "5.5 Legislación nacional vigente",
            paragraphs: [
              "Es importante reiterar la especialidad que rige de manera preferencial para las actividades que involucren datos financieros o crediticios, las cuales se encuentran bajo la Ley 1266 de 2008 y sus decretos reglamentarios, aplicándose de manera concurrente con los principios de la Ley General 1581 de 2012.",
            ],
          },
          {
            title: "5.6 Fecha de entrada en vigencia de la política de tratamiento",
            paragraphs: [
              "Esta Política de Tratamiento de la información fue actualizada y publicada el 4 de septiembre de 2026. Las áreas de Integraciones SH especialmente impactadas fueron informadas de estas disposiciones, y la Sociedad continuará adelantando trabajo de cultura, educación e información sobre protección de datos personales a lo largo de su vigencia.",
            ],
          },
        ],
      },
    ],
    effectiveDate:
      "Esta Política de Tratamiento de la información fue actualizada y publicada el 4 de septiembre de 2026.",
  },
};

export const privacyContentEn: PrivacyPolicyContent = {
  pageTitle: "Privacy and Data Processing",
  policy: {
    title: "Privacy policy",
    intro:
      "At Integraciones SH we respect your privacy. This Privacy Policy clearly explains what information we collect when you visit our website, how we use it, and what options you have. It complements the Personal Data Processing Policy published on this same page, in accordance with Law 1581 of 2012 and other applicable Colombian regulations.",
    updated: "Last updated: September 4, 2026.",
    sections: [
      {
        title: "Data controller",
        paragraphs: [
          "The data controller for personal data collected through this site is Integraciones SH, based in Colombia. You can contact us at:",
        ],
        listItems: [
          "Website: integracionessh.lat",
          "Email: info@integracionessh.lat",
          "WhatsApp: +57 321-7455642",
        ],
      },
      {
        title: "Data we collect",
        listItems: [
          "Voluntary contact data: name, phone number, email address, and message content when you contact us via WhatsApp, forms, or support channels.",
          "Browsing data: pages visited, device type, browser, language, traffic source, and interaction events, in aggregated or pseudonymized form.",
          "Cookie preferences: your choice to accept or reject analytics tracking, stored locally in your browser.",
          "Agent Platform registration data: if you create an account on the platform, the service terms and data processing policy for platform users also apply.",
        ],
        paragraphs: [
          "Through this website we may collect:",
          "We do not request sensitive data through this site unless you voluntarily provide it when contacting us.",
        ],
      },
      {
        title: "How we use your information",
        listItems: [
          "Respond to inquiries, demos, quotes, and support requests.",
          "Inform you about Agent Platform and Integraciones SH services.",
          "Measure site usage and improve content, navigation, and experience.",
          "Comply with legal, accounting, and security obligations.",
          "Prevent fraudulent or unauthorized use of the site.",
        ],
        paragraphs: [
          "We use the collected data to:",
          "We do not sell or rent your personal information to third parties. We only share data when necessary to provide the service, comply with the law, or with your authorization.",
        ],
      },
      {
        title: "Legal basis for processing",
        paragraphs: [
          "The processing of your data is based, as applicable, on your consent, the execution of pre-contractual or contractual measures, Integraciones SH's legitimate interest in operating and improving the site, or compliance with legal obligations, in accordance with Law 1581 of 2012 and Decree 1377 of 2013.",
        ],
      },
      {
        title: "Cookies and similar technologies",
        listItems: [
          "Technical or preference cookies: store your decision on the cookie banner (accept or reject analytics).",
          "Google Analytics 4: only activated if you accept analytics tracking. It collects usage data in aggregated form, with anonymized IP address. We do not use personalized advertising or remarketing cookies on this site.",
        ],
        paragraphs: [
          "This site uses cookies and local storage technologies to remember your preferences and measure traffic. In particular:",
          "You can accept or reject analytics from the cookie banner when visiting the site. You can also delete cookies from your browser settings or install the Google Analytics opt-out add-on.",
          "If you reject analytics cookies, the site will continue to function normally; only statistical traffic measurement will be limited.",
        ],
      },
      {
        title: "Third parties and external links",
        paragraphs: [
          "The site may link to third-party services such as WhatsApp, social networks, the Agent Platform, or API documentation. When you leave our site, those providers' privacy policies apply.",
          "When you click a WhatsApp link or register on the platform, the processing of your data in that environment is governed by the respective service terms and by our data processing policy when Integraciones SH acts as controller or processor.",
        ],
      },
      {
        title: "Data retention",
        paragraphs: [
          "We retain information for as long as necessary to fulfill the described purposes, handle requests, maintain business relationships, and comply with legal obligations. Analytics data is retained according to the periods configured in Google Analytics and Integraciones SH retention policies.",
        ],
      },
      {
        title: "Your rights",
        paragraphs: [
          "As a data subject in Colombia, you may access, update, rectify, and delete your information, revoke authorizations when applicable, and file inquiries or complaints with Integraciones SH or the Superintendence of Industry and Commerce.",
          "The channels, deadlines, and detailed procedures to exercise these rights are set out in the Personal Data Processing Policy on this page.",
        ],
      },
      {
        title: "Security",
        paragraphs: [
          "We apply reasonable technical, human, and administrative measures to protect information against unauthorized access, loss, alteration, or improper disclosure. No system is completely infallible; we recommend not sending sensitive information through insecure channels.",
        ],
      },
      {
        title: "Minors",
        paragraphs: [
          "This site and Integraciones SH services are intended for adults or persons with authorization from their legal representative. We do not intentionally collect data from minors under 18. If we detect that data has been collected without authorization, we will proceed to delete it.",
        ],
      },
      {
        title: "Changes to this policy",
        paragraphs: [
          "We may update this Privacy Policy to reflect changes to the site, the law, or our practices. The date of the last update will be indicated at the end of this section. We recommend reviewing this page periodically.",
        ],
      },
    ],
    contact: {
      title: "Contact",
      paragraphs: [
        "To exercise your rights or resolve privacy questions, write to info@integracionessh.lat, WhatsApp +57 321-7455642, or see the site Terms and Conditions.",
      ],
    },
  },
  dataTreatment: {
    title: "Personal Data Processing Policy",
    subtitle:
      "Formal document in accordance with Law 1581 of 2012, Law 1266 of 2008, and related regulations.",
    introductionTitle: "Introduction",
    introduction: [
      "Integraciones SH is a company specialized in automation solutions, artificial intelligence agents, and omnichannel communication for SMEs, with the Agent Platform for WhatsApp Business, chatbots, inbox, campaigns, collections, and API.",
      "Integraciones SH respects people and therefore their personal data, and seeks to sufficiently inform individuals about their rights as data subjects.",
      "It is important to note that the rights of data subjects under the Special Law, in particular those referred to in Article 16 on \"Petitions, Inquiries and Complaints\", are provided for in the Company's internal manuals.",
    ],
    chapters: privacyContentEs.dataTreatment.chapters,
    effectiveDate:
      "This Data Processing Policy was updated and published on September 4, 2026.",
  },
};

export const privacyContent: Record<"es" | "en", PrivacyPolicyContent> = {
  es: privacyContentEs,
  en: privacyContentEn,
};
