// Copyright [2025] [Banana.ch SA - Lugano Switzerland]
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


// @id = ch.banana.liechtenstein.import.llb
// @api = 1.0
// @pubdate = 2025-05-19
// @publisher = Banana.ch SA
// @description = Liechtensteinische Landesbank - Import account statement .csv (Banana+ Advanced)
// @description.de = Liechtensteinische Landesbank -  Bewegungen importieren .csv (Banana+ Advanced)
// @description.en = Liechtensteinische Landesbank - Import account statement .csv (Banana+ Advanced)
// @description.fr = Liechtensteinische Landesbank - Importer mouvements .csv (Banana+ Advanced)
// @description.it = Liechtensteinische Landesbank - Importa movimenti .csv (Banana+ Advanced)
// @doctype = *
// @docproperties =
// @task = import.transactions
// @outputformat = transactions.simple
// @inputdatasource = openfiledialog
// @inputfilefilter = Text files (*.txt *.csv);;All files (*.*)
// @inputfilefilter.de = Text (*.txt *.csv);;Alle Dateien (*.*)
// @inputfilefilter.fr = Texte (*.txt *.csv);;Tous (*.*)
// @inputfilefilter.it = Testo (*.txt *.csv);;Tutti i files (*.*)
// @includejs = import.utilities.js

/**
 * Parse the data and return the data to be imported as a tab separated file.
 */
function exec(string, isTest) {

   var importUtilities = new ImportUtilities(Banana.document);

   if (isTest !== true && !importUtilities.verifyBananaAdvancedVersion())
      return "";

   var fieldSeparator = ",";
   var transactions = Banana.Converter.csvToArray(string, fieldSeparator, '"');

   // Format 1
   var format1 = new LlbFormat1();
   let transactionsData = format1.getFormattedData(transactions, importUtilities);
   if (format1.match(transactionsData)) {
      transactions = format1.convert(transactionsData);
      return Banana.Converter.arrayToTsv(transactions);
   }

   importUtilities.getUnknownFormatError();

   return "";
}

/**
 * Liechtensteinische Landesbank - Format 1
 * This format is used for the Liechtensteinische Landesbank account statement.
 */
var LlbFormat1 = class LlbFormat1 {

   constructor() {
      this.decimalSeparator = ".";
   }

   getFormattedData(inData, importUtilities) {
      var columns = importUtilities.getHeaderData(inData, 0); //array
      var rows = importUtilities.getRowData(inData, 1); //array of array
      let form = [];

      let convertedColumns = [];

      convertedColumns = this.convertHeaderDe(columns);
      if (convertedColumns.length > 0) {
         importUtilities.loadForm(form, convertedColumns, rows);
         return form;
      }

      return [];
   }

   convertHeaderDe(columns) {
      let convertedColumns = [];
      for (var i = 0; i < columns.length; i++) {
         switch (columns[i]) {
            case "Buchungsdatum":
               convertedColumns[i] = "Date";
               break;
            case "Valutadatum":
               convertedColumns[i] = "DateValue";
               break;
            case "Referenz-Nr.":
               convertedColumns[i] = "ExternalReference";
               break;
            case "Buchungstext":
               convertedColumns[i] = "Description";
               break;
            case "Betrag":
               convertedColumns[i] = "Amount";
               break;
            default:
               break;
         }
      }

      if (convertedColumns.indexOf("Date") < 0
         || convertedColumns.indexOf("DateValue") < 0
         || convertedColumns.indexOf("Description") < 0
         || convertedColumns.indexOf("Amount") < 0) {
         return [];
      }
      return convertedColumns;
   }

   /** Return true if the transactions match this format */
   match(transactionsData) {

      if (transactionsData.length === 0)
         return false;

      for (var i = 0; i < transactionsData.length; i++) {
         var transaction = transactionsData[i];

         var formatMatched = false;

         if (transaction["Date"] && transaction["Date"].length >= 8 &&
            transaction["Date"].match(/^[0-9]+\.[0-9]+\.[0-9]+$/))
            formatMatched = true;
         else
            formatMatched = false;

         if (transaction["DateValue"] && transaction["DateValue"].length >= 8 &&
            transaction["DateValue"].match(/^[0-9]+\.[0-9]+\.[0-9]+$/))
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched)
            return true;
      }
      return false;
   }

   /** Convert the transaction to the format to be imported */
   convert(rows) {
      var transactionsToImport = [];

      for (var i = 0; i < rows.length; i++) {
         if (rows[i]["Date"] && rows[i]["Date"].length >= 8 &&
            rows[i]["Date"].match(/^[0-9]+\.[0-9]+\.[0-9]+$/))
            transactionsToImport.push(this.mapTransaction(rows[i]));
      }

      transactionsToImport = transactionsToImport.reverse();

      // Add header and return
      var header = [["Date", "DateValue", "Doc", "ExternalReference", "Description", "Income", "Expenses"]];
      return header.concat(transactionsToImport);
   }

   /** Return the transaction converted in the import format */
   mapTransaction(element) {
      var mappedLine = [];
      mappedLine.push(Banana.Converter.toInternalDateFormat(element['Date'], "dd.mm.yy"));
      mappedLine.push(Banana.Converter.toInternalDateFormat(element['DateValue'], "dd.mm.yy"));
      mappedLine.push(""); // Doc is empty for now
      mappedLine.push(element['ExternalReference']);
      var tidyDescr = element['Description'].replace(/\r\n/g, " "); //remove new line && new row characters
      mappedLine.push(Banana.Converter.stringToCamelCase(tidyDescr));
      let amount = element['Amount'];
      if (amount.indexOf('-') < 0) {
         mappedLine.push(this.getAmount(amount, false));
         mappedLine.push("");
      } else {
         mappedLine.push("");
         mappedLine.push(this.getAmount(amount, true));
      }

      return mappedLine;
   }

   getAmount(amtString, isExpense) {
      if (isExpense) // contains "-"
         return Banana.Converter.toInternalNumberFormat(amtString.slice(6), this.decimalSeparator);
      else
         return Banana.Converter.toInternalNumberFormat(amtString.slice(4), this.decimalSeparator);
   }

}