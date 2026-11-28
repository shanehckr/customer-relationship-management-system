<?php
declare(strict_types=1);

/** Public Terms of Service + Privacy Policy. Text comes from legal_documents (is_current = 1). */

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
require_once __DIR__ . "/config/database.php";

$docs = [];
$res = $conn->query(
    "SELECT doc_type, version, content, effective_date FROM legal_documents WHERE is_current = 1"
);
while ($row = $res->fetch_assoc()) {
    $docs[$row["doc_type"]] = $row;
}

function legal_date(array $doc): string
{
    return date("F j, Y", strtotime((string) $doc["effective_date"]));
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms and Privacy Policy - Customer Management System</title>
  <link rel="stylesheet" href="all-pages-css/terms.css">
</head>
<body>
  <div class="page">

    <div class="top">
      <button type="button" class="back" id="backBtn" aria-label="Go back">
        <svg class="back-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg><span>Back</span>
      </button>
      <span class="brand">Customer Relationship Management System</span>
    </div>

    <div class="toc">
      <a href="#terms">Terms of Service</a>
      <a href="#privacy">Privacy Policy</a>
    </div>

    <?php if (isset($docs["terms"])): ?>
    <section class="card" id="terms">
      <h1>Terms of Service</h1>
      <div class="accent-bar"></div>
      <p class="updated">Last updated: <?= htmlspecialchars(legal_date($docs["terms"])) ?></p>
      <?= $docs["terms"]["content"] /* already sanitized when saved by legal-api.php */ ?>
    </section>
    <?php endif; ?>

    <?php if (isset($docs["privacy"])): ?>
    <section class="card" id="privacy">
      <h2>Privacy Policy</h2>
      <div class="accent-bar"></div>
      <p class="updated">Last updated: <?= htmlspecialchars(legal_date($docs["privacy"])) ?></p>
      <?= $docs["privacy"]["content"] ?>
    </section>
    <?php endif; ?>

    <?php if (!$docs): ?>
    <section class="card"><p>This page is not available yet. Please check back soon.</p></section>
    <?php endif; ?>

  </div>

  <script>
    document.querySelectorAll('.toc a').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var target = document.querySelector(link.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
        window.history.replaceState(null, '', link.getAttribute('href'));
      });
    });

    // The pill of the section you are reading turns green (follows the scrolling, and the click).
    var tocLinks = document.querySelectorAll('.toc a');
    var sections = document.querySelectorAll('section.card[id]');
    function setActive(id) {
      tocLinks.forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('href') === '#' + id); });
    }
    tocLinks.forEach(function (l) {
      l.addEventListener('click', function () { setActive(l.getAttribute('href').slice(1)); });
    });
    if (sections.length) {
      setActive(sections[0].id);
      if ('IntersectionObserver' in window) {
        var spy = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { if (e.isIntersecting) setActive(e.target.id); });
        }, { rootMargin: '-30% 0px -60% 0px' });
        sections.forEach(function (s) { spy.observe(s); });
      }
    }

    document.getElementById('backBtn').addEventListener('click', function () {
      if (window.history.length > 1) { window.history.back(); return; }
      window.close();
      setTimeout(function () {
        var ref = document.referrer;
        window.location.href = ref && ref.indexOf(window.location.origin) === 0 ? ref : 'login.php';
      }, 200);
    });
  </script>
</body>
</html>
